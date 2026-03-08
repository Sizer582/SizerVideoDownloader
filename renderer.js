// Removed direct electron require 
// Using secure window.api exposed via preload.js

// Elemanları Seç
const urlInput = document.getElementById('urlInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const downloadBtn = document.getElementById('downloadBtn');
const backBtn = document.getElementById('backBtn');
const statusDiv = document.getElementById('status');
const qualitySelect = document.getElementById('qualitySelect');
const pasteBtn = document.getElementById('pasteBtn');

const inputSection = document.getElementById('input-section');
const qualitySection = document.getElementById('quality-section');
const cancelBtn = document.getElementById('cancelBtn');
const videoTitleLabel = document.getElementById('video-title');

const minBtn = document.getElementById('minBtn');
const closeBtn = document.getElementById('closeBtn');

// Settings Elements
const openSettingsBtn = document.getElementById('openSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const settingsModal = document.getElementById('settingsModal');
const btnTr = document.getElementById('btn-tr');
const btnEn = document.getElementById('btn-en');

// Dictionary
const dict = {
  tr: {
    statusReady: "Hazır",
    statusSelectQuality: "Kalite seçin.",
    statusCancelled: "İndirme kullanıcı tarafından iptal edildi.",
    inputPlaceholder: "Bağlantıyı yapıştır...",
    pasteTitle: "Panodan Yapıştır",
    analyzeTitle: "Analiz Et",
    backTitle: "Geri Dön",
    downloadTitle: "İndirmeyi Başlat",
    cancelTitle: "İndirmeyi İptal Et",
    settingsTitle: "Ayarlar",
    settingsTitle: "Ayarlar",
    languageLabel: "Dil",
    pleaseEnterLink: "Lütfen link girin.",
    historyTitle: "İndirme Geçmişi",
    qualityBestMp4: "En Yüksek (MP4)",
    qualityBestMkv: "En Yüksek (MKV)",
    deleteItem: "Sil",
    historyEmpty: "Geçmiş henüz boş."
  },
  en: {
    statusReady: "Ready",
    statusSelectQuality: "Select quality.",
    statusCancelled: "Download cancelled by user.",
    inputPlaceholder: "Paste link here...",
    pasteTitle: "Paste from Clipboard",
    analyzeTitle: "Analyze",
    backTitle: "Go Back",
    downloadTitle: "Start Download",
    cancelTitle: "Cancel Download",
    settingsTitle: "Settings",
    languageLabel: "Language",
    pleaseEnterLink: "Please enter a link.",
    historyTitle: "Download History",
    qualityBestMp4: "Highest (MP4)",
    qualityBestMkv: "Highest (MKV)",
    deleteItem: "Delete",
    historyEmpty: "History is empty."
  }
};

let currentLang = localStorage.getItem('appLang') || 'tr';

function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('appLang', lang);

  // UI Flag Selection Update
  if (lang === 'tr') {
    btnTr.classList.add('active');
    btnEn.classList.remove('active');
  } else {
    btnEn.classList.add('active');
    btnTr.classList.remove('active');
  }

  // Update HTML data-i18n attributes
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[lang][key]) el.innerText = dict[lang][key];
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[lang][key]) el.placeholder = dict[lang][key];
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (dict[lang][key]) el.title = dict[lang][key];
  });

  // Update status if it's an exact match string
  const currentStatus = statusDiv.innerText;
  const statusKeys = ['statusReady', 'statusSelectQuality', 'statusCancelled', 'pleaseEnterLink'];
  for (let key of statusKeys) {
    if (currentStatus === dict['tr'][key] || currentStatus === dict['en'][key]) {
      statusDiv.innerText = dict[lang][key];
      break;
    }
  }
}

// Initial Lang Load
applyLang(currentLang);

btnTr.addEventListener('click', () => applyLang('tr'));
btnEn.addEventListener('click', () => applyLang('en'));

openSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'flex');
closeSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'none');

// Değişkenler
let currentUrl = '';
let currentTitle = '';
let currentThumbnail = '';
let lastDownloadedPath = '';

// Pencere Kontrolleri
minBtn.addEventListener('click', () => window.api.send('app:minimize'));
closeBtn.addEventListener('click', () => window.api.send('app:close'));

// Focus olayında otomatik yapıştırmayı kaldırıldı (Kullanıcı isteği üzerine)
// "Yapıştır Butonu" çalışmaya devam ediyor.

// Yapıştır Butonu
pasteBtn.addEventListener('click', async () => {
  try {
    const text = await window.api.clipboard.readText();
    if (typeof text === 'string' && text.trim()) {
      urlInput.value = text.trim();
      urlInput.focus();
    }
  } catch (err) {
    console.error("Clipboard okuma hatası:", err);
  }
});

// 1. ADIM: ANALİZ ET
analyzeBtn.addEventListener('click', () => {
  const url = urlInput.value.trim();
  if (!url) return setStatus(dict[currentLang].pleaseEnterLink, "error");

  currentUrl = url;
  window.api.send('analyze-link', { url, lang: currentLang });
});

// ANALİZ SONUCU GELDİĞİNDE
window.api.on('analysis-complete', (data) => {
  currentTitle = data.title;
  currentThumbnail = data.thumbnail || '';
  videoTitleLabel.innerText = data.title.length > 40 ? data.title.substring(0, 40) + '...' : data.title;

  const maxHeight = data.maxHeight || 9999;
  const heightMap = {
    '8k': 4320, '4k': 2160, '2k': 1440, '1080p': 1080, '720p': 720,
    '480p': 480, '360p': 360, '240p': 240, '144p': 144
  };

  Array.from(qualitySelect.options).forEach(opt => {
    let hide = false;
    const qValue = opt.value;

    // "best" options are always visible
    if (qValue === 'best-mp4' || qValue === 'best-mkv') {
      opt.style.display = '';
      opt.disabled = false;
      return;
    }

    const qKey = qValue.split('-')[0];
    if (heightMap[qKey] && maxHeight < heightMap[qKey]) {
      hide = true;
    }

    if (hide) {
      opt.style.display = 'none';
      opt.disabled = true;
    } else {
      opt.style.display = '';
      opt.disabled = false;
    }
  });

  // Always default to "best-mp4"
  qualitySelect.value = 'best-mp4';

  // Arayüzü Değiştir
  inputSection.style.display = 'none';
  qualitySection.style.display = 'flex';

  const videoThumbnail = document.getElementById('video-thumbnail');
  if (data.thumbnail) {
    videoThumbnail.src = data.thumbnail;
    videoThumbnail.style.display = 'block';
  } else {
    videoThumbnail.style.display = 'none';
  }

  // Eğer en üstteki seçenek disable edilmişse geçerli bir tane seç
  if (qualitySelect.options[qualitySelect.selectedIndex].disabled) {
    for (let i = 0; i < qualitySelect.options.length; i++) {
      if (!qualitySelect.options[i].disabled) {
        qualitySelect.selectedIndex = i;
        break;
      }
    }
  }

  setStatus(dict[currentLang].statusSelectQuality, "normal");
});

// GERİ BUTONU
backBtn.addEventListener('click', () => {
  qualitySection.style.display = 'none';
  inputSection.style.display = 'flex';
  document.getElementById('video-thumbnail').style.display = 'none';
  setStatus(dict[currentLang].statusReady, "normal");
});

// 2. ADIM: İNDİR
downloadBtn.addEventListener('click', () => {
  const quality = qualitySelect.value;

  downloadBtn.style.display = 'none';
  cancelBtn.style.display = 'flex';
  backBtn.style.display = 'none';
  qualitySelect.disabled = true;

  window.api.send('start-download', {
    url: currentUrl,
    quality: quality,
    title: currentTitle,
    lang: currentLang
  });
});

cancelBtn.addEventListener('click', () => {
  window.api.send('cancel-download', currentLang);
});

function resetDownloadUI() {
  downloadBtn.style.display = 'flex';
  cancelBtn.style.display = 'none';
  backBtn.style.display = 'flex';
  qualitySelect.disabled = false;
}

// BAŞARILI İNDİRME SONRASI
window.api.on('download-success', (filePath) => {
  lastDownloadedPath = filePath;
  resetDownloadUI();

  // Geçmişe Ekle
  saveToHistory(currentTitle, currentThumbnail, filePath);
  renderHistory();
});

// DURUM MESAJLARI
window.api.on('status', ({ text, type }) => {
  if (type === 'error' || type === 'idle') {
    resetDownloadUI();
  }
  setStatus(text, type);
});

function setStatus(text, type) {
  statusDiv.innerText = text;
  statusDiv.className = '';
  if (type === 'loading') statusDiv.classList.add('status-loading');
  if (type === 'success') statusDiv.classList.add('status-success');
  if (type === 'error') statusDiv.classList.add('status-error');
}

// --- İNDİRME GEÇMİŞİ LOKAL DEPOLAMA ---
const openHistoryBtn = document.getElementById('openHistoryBtn');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');
const historyModal = document.getElementById('historyModal');
const historyListModal = document.getElementById('history-list-modal');

openHistoryBtn.addEventListener('click', () => {
  renderHistory();
  historyModal.style.display = 'flex';
});

closeHistoryBtn.addEventListener('click', () => {
  historyModal.style.display = 'none';
});

function saveToHistory(title, thumbnail, path) {
  let history = JSON.parse(localStorage.getItem('downloadHistory')) || [];
  history = history.filter(h => h.path !== path);
  history.unshift({ title, thumbnail, path, date: new Date().toLocaleString() });
  if (history.length > 50) history = history.slice(0, 50);
  localStorage.setItem('downloadHistory', JSON.stringify(history));
}

function deleteHistoryItem(index) {
  let history = JSON.parse(localStorage.getItem('downloadHistory')) || [];
  history.splice(index, 1);
  localStorage.setItem('downloadHistory', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const currentLang = localStorage.getItem('language') || 'tr';
  let history = JSON.parse(localStorage.getItem('downloadHistory')) || [];

  historyListModal.innerHTML = '';

  if (history.length === 0) {
    historyListModal.innerHTML = `<div style="text-align:center; padding:40px; color:#666;">
      <p>${dict[currentLang].historyEmpty}</p>
    </div>`;
    return;
  }

  history.forEach((item, index) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'history-item';

    itemDiv.innerHTML = `
      <img src="${item.thumbnail || 'assets/icon.png'}" class="history-thumb" onerror="this.src='assets/icon.png'">
      <div class="history-info">
        <div class="title" title="${item.title}">${item.title}</div>
        <div class="date">${item.date || ''}</div>
      </div>
      <div style="display: flex; gap: 5px;">
        <button class="modal-action-btn" title="Klasör / Folder">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
        </button>
        <button class="delete-history-btn" title="${dict[currentLang].deleteItem}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
    `;

    // Folder button
    itemDiv.querySelectorAll('button')[0].onclick = () => window.api.send('open-folder', item.path);
    // Delete button
    itemDiv.querySelectorAll('button')[1].onclick = () => deleteHistoryItem(index);

    historyListModal.appendChild(itemDiv);
  });
}

// Uygulama Açıldığında İlk Yükle
renderHistory();

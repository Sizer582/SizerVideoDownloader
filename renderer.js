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
    qualityBest: "En Yüksek (Otomatik)"
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
    qualityBest: "Highest (Automatic)"
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

    // "best" is always visible
    if (qValue === 'best') {
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

  // Always default to "best"
  qualitySelect.value = 'best';

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
  renderHistory(); // İçeriği son halinden güncelle
  historyModal.style.display = 'flex';
});

closeHistoryBtn.addEventListener('click', () => {
  historyModal.style.display = 'none';
});

function saveToHistory(title, thumbnail, path) {
  let history = JSON.parse(localStorage.getItem('downloadHistory')) || [];

  // Aynı dosya varsa silip en başa tekrar ekleyelim ki en üstte görünsün.
  history = history.filter(h => h.path !== path);

  history.unshift({ title, thumbnail, path }); // Başa ekle
  // Limitsiz olması istendi (scroll yapılabilmesi için), dilenirse güvenlik için max 50-100 limit koyulabilir.
  if (history.length > 50) history = history.slice(0, 50);

  localStorage.setItem('downloadHistory', JSON.stringify(history));
}

function renderHistory() {
  let history = JSON.parse(localStorage.getItem('downloadHistory')) || [];

  historyListModal.innerHTML = '';

  if (history.length === 0) {
    historyListModal.innerHTML = `<p style="color:#666; text-align:center; font-size:14px;">Geçmiş boş / History is empty.</p>`;
    return;
  }

  history.forEach(item => {
    let div = document.createElement('div');
    div.className = 'history-item-modal';

    let img = document.createElement('img');
    img.className = 'history-thumb';
    // Eğer analizde thumbnail yoksa şablon gri renk atarız.
    img.src = item.thumbnail || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="45"><rect width="80" height="45" fill="%23333"/></svg>';

    let detailsDiv = document.createElement('div');
    detailsDiv.className = 'history-details';

    let titleSpan = document.createElement('span');
    titleSpan.className = 'history-title-modal';
    titleSpan.innerText = item.title;
    titleSpan.title = item.title;

    let actionsDiv = document.createElement('div');
    actionsDiv.className = 'history-actions-modal';

    let folderBtn = document.createElement('button');
    folderBtn.innerHTML = '📂 Klasör';
    folderBtn.onclick = () => window.api.send('open-folder', item.path);

    let playBtn = document.createElement('button');
    playBtn.innerHTML = '▶ Oynat';
    playBtn.onclick = () => window.api.send('play-video', item.path);

    actionsDiv.appendChild(folderBtn);
    actionsDiv.appendChild(playBtn);

    detailsDiv.appendChild(titleSpan);
    detailsDiv.appendChild(actionsDiv);

    div.appendChild(img);
    div.appendChild(detailsDiv);

    historyListModal.appendChild(div);
  });
}

// Uygulama Açıldığında İlk Yükle
renderHistory();
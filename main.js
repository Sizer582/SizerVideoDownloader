const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require('electron');
const path = require('path');
const YTDlpWrap = require('yt-dlp-wrap').default;
const fs = require('fs');

// Klasördeki exe'yi bul
const execPath = path.join(__dirname, 'yt-dlp.exe');
const ytDlpWrap = new YTDlpWrap(execPath);

let mainWindow;
let activeDownloadProcess = null;
let activeDownloadPath = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 480,
    resizable: false,
    maximizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: "Sizer Video Downloader",
    backgroundColor: '#050505',
    frame: false,
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile('index.html');
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

// Pencere Kontrolleri
ipcMain.on('app:minimize', () => { mainWindow.minimize(); });
ipcMain.on('app:close', () => { mainWindow.close(); });
ipcMain.handle('read-clipboard', () => clipboard.readText());

// --- ANALİZ ET ---
ipcMain.on('analyze-link', async (event, data) => {
  let url = typeof data === 'string' ? data : data.url;
  const lang = data.lang || 'tr';

  if (!url) {
    const err = lang === 'en' ? 'Invalid URL format.' : 'Geçersiz URL formatı.';
    event.reply('status', { text: err, type: 'error' });
    return;
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    if (url.includes('.')) {
      url = 'https://' + url;
    } else {
      const err = lang === 'en' ? 'Invalid URL format.' : 'Geçersiz URL formatı.';
      event.reply('status', { text: err, type: 'error' });
      return;
    }
  }

  try {
    const msg = lang === 'en' ? 'Scanning link...' : 'Bağlantı taranıyor...';
    event.reply('status', { text: msg, type: 'loading' });
    let metadata = await ytDlpWrap.getVideoInfo(url);
    let safeTitle = metadata.title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);

    // En yüksek çözünürlüğü (height) bulalım
    let maxHeight = 0;
    if (metadata.formats) {
      metadata.formats.forEach(f => {
        if (f.vcodec !== 'none' && f.height > maxHeight) maxHeight = f.height;
      });
    }

    let thumbnailUrl = metadata.thumbnail;
    if (!thumbnailUrl && metadata.thumbnails && metadata.thumbnails.length > 0) {
      thumbnailUrl = metadata.thumbnails[metadata.thumbnails.length - 1].url;
    }

    event.reply('analysis-complete', {
      title: safeTitle,
      duration: metadata.duration_string,
      maxHeight: maxHeight,
      thumbnail: thumbnailUrl
    });
  } catch (error) {
    const err = lang === 'en' ? 'Could not analyze link.' : 'Link analiz edilemedi.';
    console.error(error);
    event.reply('status', { text: err, type: 'error' });
  }
});

// --- İNDİRME İŞLEMİ (GÜNCELLENDİ) ---
ipcMain.on('start-download', async (event, data) => {
  let { url, quality, title } = data;
  const lang = data.lang || 'tr';

  if (!url) {
    const msg = lang === 'en' ? 'Invalid URL format.' : 'Geçersiz URL formatı.';
    event.reply('status', { text: msg, type: 'error' });
    return;
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    if (url.includes('.')) {
      url = 'https://' + url;
    } else {
      const msg = lang === 'en' ? 'Invalid URL format.' : 'Geçersiz URL formatı.';
      event.reply('status', { text: msg, type: 'error' });
      return;
    }
  }

  try {
    // 1. Dosya Uzantısını Belirle
    let ext = 'mp4';
    let typeName = 'Video';

    // Parse the new quality format e.g., '1080p-mkv'
    let isMkv = quality.endsWith('-mkv');
    let isMp4 = quality.endsWith('-mp4');
    let baseQuality = quality.replace('-mkv', '').replace('-mp4', '');

    if (isMkv) { ext = 'mkv'; }
    else if (isMp4) { ext = 'mp4'; }
    else if (quality === 'opus') { ext = 'opus'; typeName = 'Opus Audio'; }
    else if (quality === 'mp3') { ext = 'mp3'; typeName = 'MP3 Audio'; }

    // 2. Kayıt Yerini Sor
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: `${title}.${ext}`,
      filters: [{ name: typeName, extensions: [ext] }]
    });

    const lang = data.lang || 'tr';

    if (!filePath) {
      const msg = lang === 'en' ? 'Cancelled.' : 'İptal edildi.';
      event.reply('status', { text: msg, type: 'idle' });
      return;
    }

    activeDownloadPath = filePath;

    const msg = lang === 'en' ? `Downloading (${baseQuality.toUpperCase()})... 🚀` : `İndiriliyor (${baseQuality.toUpperCase()})... 🚀`;
    event.reply('status', { text: msg, type: 'loading' });

    // 3. Komutları Hazırla
    let args = [url, '-o', filePath];

    // FFmpeg'i yt-dlp'ye göster (Birleştirme İşlemi İçin Gerekli)
    const ffmpegPath = path.join(__dirname, 'ffmpeg.exe');
    args.push('--ffmpeg-location', ffmpegPath);

    // --- KALİTE VE SES AYARLARI ---
    const qualityMap = {
      '8k': { format: 'bestvideo[height<=4320]+bestaudio/best[height<=4320]', isAudio: false },
      '4k': { format: 'bestvideo[height<=2160]+bestaudio/best[height<=2160]', isAudio: false },
      '2k': { format: 'bestvideo[height<=1440]+bestaudio/best[height<=1440]', isAudio: false },
      '1080p': { format: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]', isAudio: false },
      '720p': { format: 'bestvideo[height<=720]+bestaudio/best[height<=720]', isAudio: false },
      '480p': { format: 'bestvideo[height<=480]+bestaudio/best[height<=480]', isAudio: false },
      '360p': { format: 'bestvideo[height<=360]+bestaudio/best[height<=360]', isAudio: false },
      '240p': { format: 'bestvideo[height<=240]+bestaudio/best[height<=240]', isAudio: false },
      '144p': { format: 'bestvideo[height<=144]+bestaudio/best[height<=144]', isAudio: false },
      'opus': { format: 'bestaudio/best', isAudio: true, aformat: 'opus' },
      'mp3': { format: 'bestaudio/best', isAudio: true, aformat: 'mp3' }
    };

    const selectedQuality = qualityMap[baseQuality];
    if (selectedQuality) {
      args.push('-f', selectedQuality.format);
      if (selectedQuality.isAudio) {
        args.push('-x', '--audio-format', selectedQuality.aformat);
      } else {
        args.push('--merge-output-format', ext);
      }
    }

    // 4. İndirmeyi Başlat
    activeDownloadProcess = ytDlpWrap.exec(args);
    activeDownloadProcess.isCancelled = false;
    const currentLang = data.lang || 'tr';

    activeDownloadProcess.on('ytDlpEvent', (eventType, eventData) => {
      if (eventType === 'download' && eventData.includes('%')) {
        let percentMatch = eventData.match(/(\d+\.?\d*)%/);
        let speedMatch = eventData.match(/at\s+([0-9a-zA-Z.\/]+)/);
        let etaMatch = eventData.match(/ETA\s+([0-9:]+)/);

        let percentText = percentMatch ? percentMatch[1] : '0';
        let speedText = speedMatch ? speedMatch[1] : (currentLang === 'en' ? 'Calculating...' : 'Hesaplanıyor...');
        let etaText = etaMatch ? etaMatch[1] : '--:--';

        const msg = currentLang === 'en'
          ? `Downloading: ${percentText}% | Speed: ${speedText} | ETA: ${etaText}`
          : `İndiriliyor: %${percentText} | Hız: ${speedText} | Kalan Süre: ${etaText}`;

        event.reply('status', {
          text: msg,
          type: 'loading'
        });
      }
    });

    activeDownloadProcess.on('close', () => {
      if (activeDownloadProcess && activeDownloadProcess.isCancelled) return;
      activeDownloadProcess = null;
      activeDownloadPath = null;
      event.reply('download-success', filePath);
      const msg = currentLang === 'en' ? 'Complete! ✅' : 'Tamamlandı! ✅';
      event.reply('status', { text: msg, type: 'success' });
    });

    activeDownloadProcess.on('error', (error) => {
      if (activeDownloadProcess && activeDownloadProcess.isCancelled) return;
      activeDownloadProcess = null;
      activeDownloadPath = null;
      console.error(error);
      const msg = currentLang === 'en' ? 'An error occurred during download.' : 'İndirme sırasında hata oluştu.';
      event.reply('status', { text: msg, type: 'error' });
    });

  } catch (error) {
    const lang = data.lang || 'tr';
    const msg = lang === 'en' ? 'Unexpected error.' : 'Beklenmedik bir hata.';
    event.reply('status', { text: msg, type: 'error' });
  }
});

// Dosya İşlemleri
ipcMain.on('open-folder', (event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.on('play-video', (event, filePath) => {
  shell.openPath(filePath);
});

// İptal Etme İşlemi
ipcMain.on('cancel-download', (event, lang = 'tr') => {
  if (activeDownloadProcess && activeDownloadProcess.ytDlpProcess) {
    activeDownloadProcess.isCancelled = true;
    const pid = activeDownloadProcess.ytDlpProcess.pid;
    require('child_process').exec(`taskkill /pid ${pid} /T /F`, (err) => {
      if (err) console.error('Taskkill error:', err);

      // Cleanup leftover cache files
      if (activeDownloadPath) {
        const partFile = activeDownloadPath + '.part';
        const ytdlFile = activeDownloadPath + '.ytdl';

        // Wait a slight delay to ensure process releases file locks
        setTimeout(() => {
          if (fs.existsSync(partFile)) {
            try { fs.unlinkSync(partFile); } catch (e) { console.error("Could not delete .part", e); }
          }
          if (fs.existsSync(ytdlFile)) {
            try { fs.unlinkSync(ytdlFile); } catch (e) { console.error("Could not delete .ytdl", e); }
          }
          activeDownloadPath = null;
        }, 1500);
      }
    });

    const msg = lang === 'en' ? 'Download cancelled by user.' : 'İndirme kullanıcı tarafından iptal edildi.';
    event.reply('status', { text: msg, type: 'error' });
    // Reset after sending message to prevent overriding
    activeDownloadProcess = null;
  }
});
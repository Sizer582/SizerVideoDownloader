const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('api', {
    send: (channel, data) => {
        // allowlist channels
        let validChannels = ['app:minimize', 'app:close', 'analyze-link', 'start-download', 'open-folder', 'play-video', 'cancel-download'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    on: (channel, func) => {
        let validChannels = ['status', 'analysis-complete', 'download-success'];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    clipboard: {
        readText: () => ipcRenderer.invoke('read-clipboard')
    }
});

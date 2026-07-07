const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('myincLocal', {
  isDesktopApp: true,
  getEngineConfig: () => ipcRenderer.invoke('engine:get-config'),
  saveEngineConfig: (patch) => ipcRenderer.invoke('engine:save-config', patch),
  getEngineStatus: () => ipcRenderer.invoke('engine:get-status'),
  restartEngine: () => ipcRenderer.invoke('engine:restart'),
  pauseEngine: () => ipcRenderer.invoke('engine:pause'),
  resumeEngine: () => ipcRenderer.invoke('engine:resume'),
});

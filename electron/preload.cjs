'use strict';

// Minimal preload. The app is self-contained in the renderer (React + IndexedDB),
// so we only expose a tiny, read-only marker that it's running as the desktop app.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dungeonForge', {
  isDesktop: true,
  platform: process.platform,
  // Выбрать папку для сохранения карт.
  chooseFolder: () => ipcRenderer.invoke('df:choose-folder'),
  // Сохранить PNG (bytes — Uint8Array) в папку dir под именем filename.
  savePng: (dir, filename, bytes) => ipcRenderer.invoke('df:save-png', dir, filename, bytes),
  // Показать файл в проводнике.
  reveal: (full) => ipcRenderer.invoke('df:reveal', full),
  // Перекрасить полосу заголовка окна под тему.
  setTitleBar: (color, symbolColor) => ipcRenderer.invoke('df:set-titlebar', color, symbolColor),
});

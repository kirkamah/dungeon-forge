'use strict';

const { app, BrowserWindow, protocol, net, shell, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

// Built renderer (Vite output) lives in ../dist relative to this file.
const DIST = path.join(__dirname, '..', 'dist');

// A stable, secure custom origin (app://bundle/...). Loading the app from a
// real origin — instead of file:// — keeps IndexedDB persistent across runs,
// which matters because Dungeon Forge saves your tiles and dungeons there.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0e0e1a',
    title: 'Dungeon Forge',
    icon: path.join(__dirname, '..', 'app-icon.ico'),
    // Прячем белую системную рамку и красим её под тему приложения
    // (цвет обновляется по IPC при смене темы).
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#1a1a2e', symbolColor: '#e8e0c8', height: 52 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;
  win.removeMenu();
  win.maximize();

  // Open external links (e.g. fonts, future help links) in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  const devUrl = process.env.DF_DEV_URL;
  if (devUrl) {
    win.loadURL(devUrl); // `npm run electron:dev` against the Vite dev server
  } else {
    win.loadURL('app://bundle/index.html');
  }

  win.on('closed', () => {
    mainWindow = null;
  });
}

// ── IPC: выбор папки и сохранение экспортированных карт на диск ──────────────
ipcMain.handle('df:choose-folder', async () => {
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  const res = await dialog.showOpenDialog(win, {
    title: 'Папка для сохранения карт',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths || !res.filePaths[0]) return null;
  return res.filePaths[0];
});

ipcMain.handle('df:save-png', async (_e, dir, filename, bytes) => {
  if (!dir) throw new Error('No folder selected');
  await fs.promises.mkdir(dir, { recursive: true });
  const full = path.join(dir, filename);
  await fs.promises.writeFile(full, Buffer.from(bytes));
  return full;
});

ipcMain.handle('df:reveal', async (_e, full) => {
  if (full) shell.showItemInFolder(full);
});

// Перекрасить полосу заголовка окна под выбранную тему.
ipcMain.handle('df:set-titlebar', (_e, color, symbolColor) => {
  if (mainWindow && !mainWindow.isDestroyed() && typeof mainWindow.setTitleBarOverlay === 'function') {
    try { mainWindow.setTitleBarOverlay({ color, symbolColor, height: 52 }); } catch { /* не критично */ }
  }
});

app.whenReady().then(() => {
  // Serve the built files from the app://bundle origin.
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    let rel = decodeURIComponent(pathname);
    if (rel === '/' || rel === '') rel = '/index.html';

    // Resolve inside DIST and refuse anything that escapes it.
    const filePath = path.normalize(path.join(DIST, rel));
    if (!filePath.startsWith(DIST)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

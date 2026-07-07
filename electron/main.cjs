const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const engine = require('./engine-process.cjs');
const { enableAutoStart } = require('./autostart.cjs');
const { createTray } = require('./tray.cjs');
const { readEngineConfig, writeEngineConfig } = require('./engine-config.cjs');

let mainWindow;
let tray;

function appRoot() {
  return app.getAppPath();
}

function candidateIndexFiles() {
  const root = appRoot();
  const resources = process.resourcesPath || root;
  return [
    path.join(root, 'dist', 'client', 'index.html'),
    path.join(root, 'dist', 'index.html'),
    path.join(root, 'client', 'index.html'),
    path.join(resources, 'app.asar', 'dist', 'client', 'index.html'),
    path.join(resources, 'app', 'dist', 'client', 'index.html'),
    path.join(resources, 'dist', 'client', 'index.html'),
  ];
}

function resolveIndexFile() {
  return candidateIndexFiles().find((item) => fs.existsSync(item));
}

function resolveAppIcon() {
  const root = appRoot();
  const resources = process.resourcesPath || root;
  return [
    path.join(root, 'assets', 'icon.ico'),
    path.join(root, 'engine-tray', 'assets', 'myinc-engine.ico'),
    path.join(resources, 'app.asar.unpacked', 'assets', 'icon.ico'),
    path.join(resources, 'app.asar.unpacked', 'engine-tray', 'assets', 'myinc-engine.ico'),
  ].find((item) => fs.existsSync(item));
}

async function loadFrontend() {
  const indexPath = resolveIndexFile();
  if (indexPath) {
    await mainWindow.loadFile(indexPath);
    return;
  }

  const devUrl = process.env.MYINC_DEV_SERVER_URL || 'http://localhost:5173';
  try {
    await mainWindow.loadURL(devUrl);
  } catch (error) {
    const message = `Não encontrei o build local do painel. Rode npm run build antes de abrir o app desktop.\n\nArquivos testados:\n${candidateIndexFiles().join('\n')}\n\nErro: ${error.message}`;
    console.error(message);
    dialog.showErrorBox('MYINC Local Engine', message);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    show: true,
    icon: resolveAppIcon(),
    backgroundColor: '#09090b',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  void loadFrontend();

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function engineStatus() {
  try {
    const statusFile = path.join(engine.engineCwd(appRoot()), '.myinc-engine', 'status.json');
    if (!fs.existsSync(statusFile)) return { status: engine.isRunning() ? 'starting' : 'stopped' };
    return JSON.parse(fs.readFileSync(statusFile, 'utf8'));
  } catch (error) {
    return { status: 'unknown', error: error.message };
  }
}

ipcMain.handle('engine:get-config', () => readEngineConfig(engine.envFilePath(appRoot())));
ipcMain.handle('engine:save-config', (_event, patch) => {
  writeEngineConfig(engine.envFilePath(appRoot()), patch && typeof patch === 'object' ? patch : {});
  return { ok: true };
});
ipcMain.handle('engine:get-status', () => ({ running: engine.isRunning(), ...engineStatus() }));
ipcMain.handle('engine:restart', () => {
  engine.restartEngine(appRoot());
  return { ok: true };
});
ipcMain.handle('engine:pause', () => {
  engine.stopEngine();
  return { ok: true };
});
ipcMain.handle('engine:resume', () => {
  engine.startEngine(appRoot());
  return { ok: true };
});

app.whenReady().then(() => {
  if (process.env.ENGINE_AUTO_START === 'true') enableAutoStart(true);
  engine.startEngine(appRoot());
  createWindow();
  tray = createTray(mainWindow, engine, appRoot());
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else mainWindow?.show();
});

app.on('before-quit', () => {
  app.isQuiting = true;
  engine.stopEngine();
  tray?.destroy?.();
});

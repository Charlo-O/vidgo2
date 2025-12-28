import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { PythonManager } from './python-manager';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let pythonManager: PythonManager | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (isDev) {
    // Development: load from Vite dev server
    // vite-plugin-electron sets VITE_DEV_SERVER_URL automatically
    const url = process.env['VITE_DEV_SERVER_URL'] || 'http://localhost:4173';
    mainWindow.loadURL(url);
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Python backend management
async function startPythonBackend() {
  pythonManager = new PythonManager();

  try {
    await pythonManager.start();
    console.log('Python backend started successfully');
  } catch (error) {
    console.error('Failed to start Python backend:', error);
  }
}

async function stopPythonBackend() {
  if (pythonManager) {
    await pythonManager.stop();
    pythonManager = null;
  }
}

// IPC handlers
ipcMain.handle('get-backend-status', async () => {
  return pythonManager?.isRunning() ?? false;
});

ipcMain.handle('get-backend-url', async () => {
  return pythonManager?.getBackendUrl() ?? 'http://localhost:8000';
});

ipcMain.handle('restart-backend', async () => {
  await stopPythonBackend();
  await startPythonBackend();
  return pythonManager?.isRunning() ?? false;
});

// App lifecycle
app.whenReady().then(async () => {
  // Start Python backend first
  await startPythonBackend();

  // Then create window
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  // Stop Python backend
  await stopPythonBackend();

  // On macOS, keep app running until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await stopPythonBackend();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

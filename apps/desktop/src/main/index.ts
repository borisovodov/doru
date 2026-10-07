import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProjectOpener, TreeStore, type ITreeStore, type ProjectSummary } from '@doru/core';
import { ConsoleLogService } from '@doru/platform';
import { NodeFileSystem } from './filesystem';

const log = new ConsoleLogService();
log.setLevel('info');

const fs = new NodeFileSystem();
const opener = new ProjectOpener(fs, { open: (path) => TreeStore.open(path) }, log);
const openStores = new Map<string, ITreeStore>();

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const preload = fileURLToPath(new URL('../preload/index.mjs', import.meta.url));
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Doru',
    webPreferences: {
      preload,
      sandbox: false,
      contextIsolation: true,
    },
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl);
  } else {
    void mainWindow.loadFile(join(fileURLToPath(new URL('..', import.meta.url)), 'renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function openProject(options: { dialog?: boolean; path?: string }): Promise<ProjectSummary | null> {
  let folder = options.path;
  if (!folder) {
    const result =
      mainWindow !== null
        ? await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory', 'createDirectory'],
            title: 'Open Project',
          })
        : await dialog.showOpenDialog({
            properties: ['openDirectory', 'createDirectory'],
            title: 'Open Project',
          });
    if (result.canceled || result.filePaths[0] === undefined) {
      return null;
    }
    folder = result.filePaths[0];
  }
  const { summary, store } = await opener.open(folder);
  const previous = openStores.get(summary.path);
  previous?.close();
  openStores.set(summary.path, store);
  return summary;
}

ipcMain.handle('project:open', (_event, options: { dialog?: boolean; path?: string } = {}) =>
  openProject(options),
);

void app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  for (const store of openStores.values()) {
    store.close();
  }
  openStores.clear();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

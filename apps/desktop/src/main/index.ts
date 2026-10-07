import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HistoryLog } from '@doru/ai';
import {
  HISTORY_FILE_NAME,
  OpQueue,
  ProjectOpener,
  ReadGedcomImporter,
  SqliteTreeRepository,
  TreeStore,
  importGedcomOp,
  type GedcomImportResult,
  type ITreeStore,
  type ProjectSummary,
} from '@doru/core';
import { ConsoleLogService } from '@doru/platform';
import { NodeFileSystem } from './filesystem';

const log = new ConsoleLogService();
log.setLevel('info');

const fs = new NodeFileSystem();
const opener = new ProjectOpener(fs, { open: (path) => TreeStore.open(path) }, log);

interface ProjectRuntime {
  store: ITreeStore;
  repo: SqliteTreeRepository;
  queue: OpQueue;
  history: HistoryLog;
}

const runtimes = new Map<string, ProjectRuntime>();

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

async function ensureRuntime(projectPath: string): Promise<{ summary: ProjectSummary; runtime: ProjectRuntime }> {
  const existing = runtimes.get(projectPath);
  if (existing) {
    return { summary: { path: projectPath, treePath: existing.store.path, schemaVersion: existing.store.userVersion(), created: [], healed: [] }, runtime: existing };
  }
  const { summary, store } = await opener.open(projectPath);
  const repo = new SqliteTreeRepository(store.db);
  const history = new HistoryLog(fs, join(projectPath, HISTORY_FILE_NAME));
  const queue = new OpQueue((op) => {
    void history.append({ ts: op.timestamp, actor: op.actor, opId: op.id, opKind: op.kind });
  });
  const runtime: ProjectRuntime = { store, repo, queue, history };
  runtimes.set(summary.path, runtime);
  return { summary, runtime };
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
  const { summary } = await ensureRuntime(folder);
  return summary;
}

async function importGedcom(options: {
  projectPath: string;
  filePath?: string;
  dialog?: boolean;
}): Promise<GedcomImportResult | null> {
  let filePath = options.filePath;
  if (!filePath) {
    const dialogOptions: OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'GEDCOM', extensions: ['ged', 'gedcom'] }],
      title: 'Import GEDCOM',
    };
    const result =
      mainWindow !== null
        ? await dialog.showOpenDialog(mainWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || result.filePaths[0] === undefined) {
      return null;
    }
    filePath = result.filePaths[0];
  }
  const { runtime } = await ensureRuntime(options.projectPath);
  const bytes = await fs.readBinary(filePath);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const doc = new ReadGedcomImporter().import(buffer);
  const op = importGedcomOp('user:import', filePath, doc);
  runtime.queue.apply(op, { repo: runtime.repo });
  return {
    importedPersons: op.insertedPersons.length,
    importedFamilies: op.insertedFamilies.length,
    totalPersons: runtime.repo.countPersons(),
  };
}

ipcMain.handle('project:open', (_event, options: { dialog?: boolean; path?: string } = {}) =>
  openProject(options),
);

ipcMain.handle(
  'project:import',
  (_event, options: { projectPath: string; filePath?: string; dialog?: boolean }) =>
    importGedcom(options),
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
  for (const runtime of runtimes.values()) {
    runtime.store.close();
  }
  runtimes.clear();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

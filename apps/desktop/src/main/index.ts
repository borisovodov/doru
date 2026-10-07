import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HistoryLog } from '@doru/ai';
import {
  HISTORY_FILE_NAME,
  OpQueue,
  ProjectOpener,
  ReadGedcomImporter,
  RecentProjects,
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

let recents: RecentProjects | null = null;
let mainWindow: BrowserWindow | null = null;
const pendingExternalPaths: string[] = [];

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

async function ensureRuntime(
  projectPath: string,
): Promise<{ summary: ProjectSummary; runtime: ProjectRuntime }> {
  const existing = runtimes.get(projectPath);
  if (existing) {
    return {
      summary: {
        path: projectPath,
        treePath: existing.store.path,
        schemaVersion: existing.store.userVersion(),
        created: [],
        healed: [],
      },
      runtime: existing,
    };
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
    const dialogOptions: OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Open Project',
    };
    const result =
      mainWindow !== null
        ? await dialog.showOpenDialog(mainWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || result.filePaths[0] === undefined) {
      return null;
    }
    folder = result.filePaths[0];
  }
  const { summary } = await ensureRuntime(folder);
  if (recents) {
    await recents.touch(summary.path);
  }
  return summary;
}

function openExternalPath(path: string): void {
  const root = path.endsWith('.doru') ? dirname(path) : path;
  void openProject({ path: root }).then((summary) => {
    if (summary && mainWindow) {
      mainWindow.webContents.send('project:external-open', summary);
    }
  });
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

ipcMain.handle('project:recent', () => recents?.list() ?? []);

ipcMain.handle('project:close', (_event, options: { path: string }) => {
  const runtime = runtimes.get(options.path);
  if (runtime) {
    runtime.store.close();
    runtimes.delete(options.path);
  }
});

ipcMain.handle(
  'tree:list',
  async (_event, options: { projectPath: string; search?: string; limit?: number; offset?: number }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.repo.listPersons({
      search: options.search,
      limit: options.limit ?? 100,
      offset: options.offset ?? 0,
    });
  },
);

ipcMain.handle('tree:stats', async (_event, options: { projectPath: string }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  return { persons: runtime.repo.countPersons(), families: runtime.repo.countFamilies() };
});

ipcMain.handle('tree:undoState', async (_event, options: { projectPath: string }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
});

ipcMain.handle('tree:undo', async (_event, options: { projectPath: string }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  runtime.queue.undo({ repo: runtime.repo });
  return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
});

ipcMain.handle('tree:redo', async (_event, options: { projectPath: string }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  runtime.queue.redo({ repo: runtime.repo });
  return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
    for (const path of extractPathArgs(argv)) {
      openExternalPath(path);
    }
  });

  app.on('open-file', (event, path) => {
    event.preventDefault();
    if (app.isReady()) {
      openExternalPath(path);
    } else {
      pendingExternalPaths.push(path);
    }
  });
}

function extractPathArgs(argv: string[]): string[] {
  return argv.slice(1).filter((arg) => !arg.startsWith('-') && arg !== '.');
}

void app.whenReady().then(() => {
  recents = new RecentProjects(fs, join(app.getPath('userData'), 'recent.json'));
  createWindow();
  for (const path of [...extractPathArgs(process.argv), ...pendingExternalPaths]) {
    openExternalPath(path);
  }
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

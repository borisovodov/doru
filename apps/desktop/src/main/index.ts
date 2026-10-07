import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'jsonc-parser';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  AgentRuntime,
  DoruMcpServer,
  HistoryLog,
  OpenAIChatConnector,
  TreeMcpBackend,
  type ChatMessage,
  type ChatSendResult,
} from '@doru/ai';
import {
  Gedcom70Writer,
  HISTORY_FILE_NAME,
  OpQueue,
  ProjectOpener,
  ReadGedcomImporter,
  RecentProjects,
  SqliteTreeRepository,
  TreeStore,
  addPersonOp,
  importGedcomOp,
  updatePersonOp,
  type GedcomImportResult,
  type ITreeStore,
  type PersonRecord,
  type ProjectSummary,
  type TreeDocument,
} from '@doru/core';
import { ConsoleLogService } from '@doru/platform';
import { NodeFileSystem } from './filesystem';

const log = new ConsoleLogService();
log.setLevel('info');

const fs = new NodeFileSystem();
const opener = new ProjectOpener(fs, { open: (path) => TreeStore.open(path) }, log);

const AI_CONFIG_FILE = 'doru.json';

const DEFAULT_AI_CONFIG = `{
  // AI provider settings for the agent chat.
  // Any OpenAI-compatible endpoint works: OpenAI, Ollama, OpenRouter, ...
  "ai": {
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "",
    "model": "gpt-4o-mini"
  }
}
`;

interface ProjectRuntime {
  store: ITreeStore;
  repo: SqliteTreeRepository;
  queue: OpQueue;
  history: HistoryLog;
}

const runtimes = new Map<string, ProjectRuntime>();

interface PendingPermission {
  resolve: (allowed: boolean) => void;
  timer: NodeJS.Timeout;
}

const pendingPermissions = new Map<string, PendingPermission>();

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

function loadAiConfig(): { baseUrl: string; apiKey: string; model: string } | null {
  const dir = app.getPath('userData');
  const file = join(dir, AI_CONFIG_FILE);
  if (!existsSync(file)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, DEFAULT_AI_CONFIG);
  }
  const parsed = parse(readFileSync(file, 'utf8')) as {
    ai?: { baseUrl?: string; apiKey?: string; model?: string };
  };
  const ai = parsed.ai ?? {};
  const apiKey = ai.apiKey ?? '';
  const model = ai.model ?? '';
  if (!apiKey || !model) {
    return null;
  }
  return { baseUrl: ai.baseUrl ?? 'https://api.openai.com/v1', apiKey, model };
}

function requestPermission(tool: string, args: Record<string, unknown>): Promise<boolean> {
  const id = crypto.randomUUID();
  mainWindow?.webContents.send('chat:permission', { id, tool, arguments: args });
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      pendingPermissions.delete(id);
      resolve(false);
    }, 120_000);
    pendingPermissions.set(id, { resolve, timer });
  });
}

async function sendChat(options: { projectPath: string; messages: ChatMessage[] }): Promise<ChatSendResult> {
  const config = loadAiConfig();
  if (!config) {
    return {
      steps: [],
      finalText: '',
      error: `AI provider is not configured. Set "ai.apiKey" and "ai.model" in ${join(app.getPath('userData'), AI_CONFIG_FILE)}`,
    };
  }
  const { runtime } = await ensureRuntime(options.projectPath);
  const lastUser = [...options.messages].reverse().find((message) => message.role === 'user');
  const promptHash = createHash('sha256').update(lastUser?.content ?? '').digest('hex').slice(0, 12);
  const actor = `agent:${new URL(config.baseUrl).host}/${config.model}#${promptHash}`;
  const backend = new TreeMcpBackend(runtime.repo, runtime.queue, actor);
  const model = new OpenAIChatConnector(config);
  const agent = new AgentRuntime(model, backend, requestPermission);
  try {
    const result = await agent.run(options.messages);
    return { steps: result.steps, finalText: result.finalText };
  } catch (error) {
    return {
      steps: [],
      finalText: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
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

ipcMain.handle('tree:addPerson', async (_event, options: { projectPath: string; person: PersonRecord }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  runtime.queue.apply(addPersonOp('user', options.person), { repo: runtime.repo });
  return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
});

ipcMain.handle(
  'tree:updatePerson',
  async (_event, options: { projectPath: string; before: PersonRecord; after: PersonRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    runtime.queue.apply(updatePersonOp('user', options.before, options.after), { repo: runtime.repo });
    return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
  },
);

ipcMain.handle('project:export', async (_event, options: { projectPath: string }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  const dialogOptions: SaveDialogOptions = {
    defaultPath: join(options.projectPath, 'export', 'tree.ged'),
    filters: [{ name: 'GEDCOM', extensions: ['ged'] }],
    title: 'Export GEDCOM',
  };
  const result =
    mainWindow !== null
      ? await dialog.showSaveDialog(mainWindow, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);
  if (result.canceled || !result.filePath) {
    return null;
  }
  const doc: TreeDocument = {
    persons: new Map(runtime.repo.listAllPersons().map((person) => [person.id, person])),
    families: new Map(runtime.repo.listFamilies().map((family) => [family.id, family])),
    sources: new Map(),
  };
  const content = new Gedcom70Writer().export(doc);
  await fs.writeFile(result.filePath, content);
  return { path: result.filePath };
});

ipcMain.handle(
  'chat:send',
  (_event, options: { projectPath: string; messages: ChatMessage[] }) => sendChat(options),
);

ipcMain.on('chat:permission-response', (_event, options: { id: string; allow: boolean }) => {
  const pending = pendingPermissions.get(options.id);
  if (!pending) {
    return;
  }
  clearTimeout(pending.timer);
  pendingPermissions.delete(options.id);
  pending.resolve(options.allow === true);
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

function parseMcpServerArg(argv: string[]): string | null {
  const index = argv.indexOf('--mcp-server');
  if (index === -1) {
    return null;
  }
  return argv[index + 1] ?? null;
}

void app.whenReady().then(async () => {
  recents = new RecentProjects(fs, join(app.getPath('userData'), 'recent.json'));

  const mcpProject = parseMcpServerArg(process.argv);
  if (mcpProject) {
    const { runtime } = await ensureRuntime(mcpProject);
    const backend = new TreeMcpBackend(runtime.repo, runtime.queue, 'agent:mcp');
    const server = new DoruMcpServer(backend, app.getVersion());
    await server.connect(new StdioServerTransport());
    log.info(`Doru MCP server started for ${mcpProject}`);
    return;
  }

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

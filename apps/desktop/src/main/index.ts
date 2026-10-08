import { app, BrowserWindow, dialog, ipcMain, safeStorage, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, watch, type FSWatcher } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyEdits, modify, parse } from 'jsonc-parser';
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
  THEME_FILE_NAME,
  TreeStore,
  addFamilyOp,
  addNoteOp,
  addPersonOp,
  addSourceOp,
  attachCitationOp,
  deleteFamilyOp,
  detachCitationOp,
  importGedcomOp,
  updateFamilyOp,
  updatePersonOp,
  type FamilyRecord,
  type GedcomImportResult,
  type ITreeStore,
  type NoteRecord,
  type PersonRecord,
  type ProjectSummary,
  type SourceRecord,
  type TreeDocument,
} from '@doru/core';
import { ConsoleLogService } from '@doru/platform';
import { NodeFileSystem } from './filesystem';

const log = new ConsoleLogService();
log.setLevel('info');

const fs = new NodeFileSystem();
const opener = new ProjectOpener(fs, { open: (path) => TreeStore.open(path) }, log);

const AI_CONFIG_FILE = 'doru.json';
const SESSION_FILE = 'session.json';

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
const themeWatchers = new Map<string, FSWatcher>();

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
  if (!themeWatchers.has(summary.path)) {
    try {
      const watcher = watch(join(summary.path, THEME_FILE_NAME), () => {
        mainWindow?.webContents.send('theme:changed', { projectPath: summary.path });
      });
      themeWatchers.set(summary.path, watcher);
    } catch {
      log.warn('could not watch theme.css', summary.path);
    }
  }
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
    await updateSession((session) => {
      const paths = session.paths.filter((entry) => entry !== summary.path);
      return { paths: [...paths, summary.path], activePath: summary.path };
    });
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
  const text = readFileSync(file, 'utf8');
  const parsed = parse(text) as {
    ai?: { baseUrl?: string; apiKey?: string; apiKeyEncrypted?: string; model?: string };
  };
  const ai = parsed.ai ?? {};

  let apiKey = ai.apiKey ?? '';
  if (!apiKey && ai.apiKeyEncrypted) {
    try {
      apiKey = safeStorage.decryptString(Buffer.from(ai.apiKeyEncrypted, 'base64'));
    } catch {
      apiKey = '';
    }
  }
  const envKey = process.env.DORU_AI_API_KEY;
  if (envKey) {
    apiKey = envKey;
  }

  if (ai.apiKey && !ai.apiKeyEncrypted && safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(ai.apiKey).toString('base64');
    const withEncrypted = applyEdits(
      text,
      modify(text, ['ai', 'apiKeyEncrypted'], encrypted, { formattingOptions: { insertSpaces: true, tabSize: 2 } }),
    );
    const migrated = applyEdits(
      withEncrypted,
      modify(withEncrypted, ['ai', 'apiKey'], undefined, { formattingOptions: { insertSpaces: true, tabSize: 2 } }),
    );
    writeFileSync(file, migrated);
    log.info('migrated the plaintext API key into safeStorage');
  }

  const model = process.env.DORU_AI_MODEL ?? ai.model ?? '';
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

interface SessionData {
  paths: string[];
  activePath: string | null;
}

function readSession(): SessionData {
  const file = join(app.getPath('userData'), SESSION_FILE);
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as SessionData;
    if (!Array.isArray(parsed.paths) || typeof parsed.activePath !== 'string' && parsed.activePath !== null) {
      return { paths: [], activePath: null };
    }
    return parsed;
  } catch {
    return { paths: [], activePath: null };
  }
}

async function updateSession(update: (session: SessionData) => SessionData): Promise<void> {
  const dir = app.getPath('userData');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, SESSION_FILE), `${JSON.stringify(update(readSession()), null, 2)}\n`);
}

ipcMain.handle('session:get', async () => {
  const session = readSession();
  const existing = [];
  for (const path of session.paths) {
    if (await fs.exists(path)) {
      existing.push(path);
    }
  }
  return {
    paths: existing,
    activePath: existing.includes(session.activePath ?? '') ? session.activePath : null,
  };
});

ipcMain.handle('project:close', (_event, options: { path: string }) => {
  const runtime = runtimes.get(options.path);
  if (runtime) {
    runtime.store.close();
    runtimes.delete(options.path);
  }
  const watcher = themeWatchers.get(options.path);
  if (watcher) {
    watcher.close();
    themeWatchers.delete(options.path);
  }
  void updateSession((session) => {
    const paths = session.paths.filter((entry) => entry !== options.path);
    const activePath = session.activePath === options.path ? null : session.activePath;
    return { paths, activePath };
  });
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

ipcMain.handle('theme:get', async (_event, options: { projectPath: string }) => {
  await ensureRuntime(options.projectPath);
  try {
    const css = await fs.readFile(join(options.projectPath, THEME_FILE_NAME));
    return { css };
  } catch {
    return { css: '' };
  }
});

ipcMain.handle(
  'tree:notes',
  async (_event, options: { projectPath: string; personId?: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    const notes = runtime.repo.listNotes();
    if (!options.personId) {
      return notes;
    }
    return notes.filter(
      (note) => note.targetType === 'person' && note.targetId === options.personId,
    );
  },
);

ipcMain.handle('tree:addNote', async (_event, options: { projectPath: string; note: NoteRecord }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  runtime.queue.apply(addNoteOp('user', options.note), { repo: runtime.repo });
  return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
});

ipcMain.handle('tree:families', async (_event, options: { projectPath: string }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  return runtime.repo.listFamilies();
});

ipcMain.handle('tree:addFamily', async (_event, options: { projectPath: string; family: FamilyRecord }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  runtime.queue.apply(addFamilyOp('user', options.family), { repo: runtime.repo });
  return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
});

ipcMain.handle(
  'tree:updateFamily',
  async (_event, options: { projectPath: string; before: FamilyRecord; after: FamilyRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    runtime.queue.apply(updateFamilyOp('user', options.before, options.after), { repo: runtime.repo });
    return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
  },
);

ipcMain.handle('tree:deleteFamily', async (_event, options: { projectPath: string; family: FamilyRecord }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  runtime.queue.apply(deleteFamilyOp('user', options.family), { repo: runtime.repo });
  return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
});

ipcMain.handle('tree:sources', async (_event, options: { projectPath: string }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  return runtime.repo.listSources();
});

ipcMain.handle(
  'tree:addSource',
  async (
    _event,
    options: { projectPath: string; source: SourceRecord; targetType?: string; targetId?: string },
  ) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    const citation =
      options.targetType && options.targetId
        ? { targetType: options.targetType, targetId: options.targetId }
        : undefined;
    runtime.queue.apply(addSourceOp('user', options.source, citation), { repo: runtime.repo });
    return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
  },
);

ipcMain.handle('tree:attachSource', async (_event, options: { projectPath: string; sourceId: string; targetType: string; targetId: string }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  runtime.queue.apply(
    attachCitationOp('user', {
      id: crypto.randomUUID(),
      sourceId: options.sourceId,
      targetType: options.targetType,
      targetId: options.targetId,
    }),
    { repo: runtime.repo },
  );
  return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
});

ipcMain.handle('tree:detachCitation', async (_event, options: { projectPath: string; citationId: string }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  const citation = runtime.repo.getCitation(options.citationId);
  if (citation) {
    runtime.queue.apply(detachCitationOp('user', citation), { repo: runtime.repo });
  }
  return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
});

ipcMain.handle('tree:gedcomText', async (_event, options: { projectPath: string }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  const doc: TreeDocument = {
    persons: new Map(runtime.repo.listAllPersons().map((person) => [person.id, person])),
    families: new Map(runtime.repo.listFamilies().map((family) => [family.id, family])),
    sources: new Map(runtime.repo.listSources().map((source) => [source.id, source])),
  };
  return new Gedcom70Writer().export(doc);
});

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
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient('doru', process.execPath, [process.argv[1]]);
  } else {
    app.setAsDefaultProtocolClient('doru');
  }

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
  });

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

function handleProtocolUrl(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'doru:') {
      return;
    }
    const projectPath = parsed.searchParams.get('path');
    if (projectPath) {
      if (app.isReady()) {
        openExternalPath(projectPath);
      } else {
        pendingExternalPaths.push(projectPath);
      }
    }
  } catch {
    log.warn('malformed protocol url', url);
  }
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
    if (path.startsWith('doru://')) {
      handleProtocolUrl(path);
    } else {
      openExternalPath(path);
    }
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

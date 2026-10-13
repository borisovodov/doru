import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  net,
  protocol,
  safeStorage,
  type MenuItemConstructorOptions,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, watch } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyEdits, modify, parse } from 'jsonc-parser';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  AcpAgentClient,
  AI_PROVIDERS,
  AgentRuntime,
  AnthropicChatConnector,
  DEFAULT_PERMISSION_POLICY,
  DoruMcpServer,
  McpHostManager,
  OpenAIChatConnector,
  TreeMcpBackend,
  findProvider,
  type AcpMcpServerEntry,
  type AiProviderPreset,
  type ChatMessage,
  type ChatSendResult,
  type McpServerConfig,
} from '@doru/ai';
import {
  Gedcom70Writer,
  MEDIA_DIR_NAME,
  OpQueue,
  ProjectOpener,
  ReadGedcomImporter,
  RecentProjects,
  SqliteTreeRepository,
  TREE_FILE_EXTENSION,
  TreeStore,
  addEventOp,
  addFamilyOp,
  addMediaOp,
  addNoteOp,
  addPersonOp,
  addSourceOp,
  attachCitationOp,
  deleteEventOp,
  deleteFamilyOp,
  deleteMediaOp,
  detachCitationOp,
  importGedcomOp,
  updateFamilyOp,
  updatePersonOp,
  type EventRecord,
  type FamilyRecord,
  type GedcomImportResult,
  type ITreeStore,
  type MediaRecord,
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

if (process.env.DORU_USER_DATA) {
  app.setPath('userData', process.env.DORU_USER_DATA);
}

const fs = new NodeFileSystem();
const opener = new ProjectOpener(fs, { open: (path) => TreeStore.open(path) }, log);

const AI_CONFIG_FILE = 'doru.json';
const SESSION_FILE = 'session.json';
const DEFAULT_DARK_THEME = 'doru-dark';
const DEFAULT_LIGHT_THEME = 'doru-light';

const DEFAULT_AI_CONFIG = `{
  // AI provider settings for the agent chat.
  // "provider": "openai-compatible" (default) or "acp" (Agent Client Protocol,
  // e.g. Zed-style coding agents).
  "ai": {
    "provider": "openai-compatible",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "",
    "model": "gpt-4o-mini",
    // For "acp": the agent binary to spawn and its arguments.
    // "command": "my-agent",
    // "args": []
  },
  // Optional: external MCP servers whose tools the in-app agent can use
  // (web search, FamilySearch, filesystem, ...). Each server is spawned as a
  // subprocess; tools are prefixed with the server name, e.g. "web:search".
  // "mcp": {
  //   "servers": [
  //     { "name": "web", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-brave-search"], "env": { "BRAVE_API_KEY": "..." } }
  //   ]
  // },
  // Built-in themes are chosen separately for dark and light mode; which one
  // is applied is decided by the operating system appearance.
  // "theme": {
  //   "dark": "doru-dark",
  //   "light": "doru-light"
  // }
}
`;

interface ProjectRuntime {
  store: ITreeStore;
  repo: SqliteTreeRepository;
  queue: OpQueue;
}

const runtimes = new Map<string, ProjectRuntime>();

interface PendingPermission {
  resolve: (allowed: boolean) => void;
  timer: NodeJS.Timeout;
}

const pendingPermissions = new Map<string, PendingPermission>();

let recents: RecentProjects | null = null;
const projectWindows = new Map<string, BrowserWindow>();
const windowProject = new Map<number, string | null>();
const pendingExternalPaths: string[] = [];

function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(app.getAppPath(), 'resources', 'icon.png');
}

function focusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow();
}

function windowById(id: number): BrowserWindow | null {
  return (
    BrowserWindow.getAllWindows().find(
      (window) => !window.isDestroyed() && window.webContents.id === id,
    ) ?? null
  );
}

function installMenu(): void {
  const template: MenuItemConstructorOptions[] = [];
  if (process.platform === 'darwin') {
    template.push({ role: 'appMenu' });
  } else {
    template.push({ label: 'File', submenu: [{ role: 'quit' }] });
  }
  template.push({ role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function bindWindowToProject(window: BrowserWindow, projectPath: string): void {
  windowProject.set(window.webContents.id, projectPath);
  projectWindows.set(projectPath, window);
  window.setTitle(`${basename(projectPath)} — Dóru`);
  window.webContents.send('project:bind', { path: projectPath });
}

const TITLE_BAR_HEIGHT = 38;

interface ThemeDefinition {
  name?: string;
  type?: string;
  colors?: Record<string, string>;
}

function themeDefinition(name: string): ThemeDefinition {
  try {
    return JSON.parse(readFileSync(join(themesDir(), name, 'theme.json'), 'utf8')) as ThemeDefinition;
  } catch {
    return {};
  }
}

function titleBarOverlayOptions(): { color: string; symbolColor: string; height: number } {
  const dark = nativeTheme.shouldUseDarkColors;
  const themeName = dark ? themeConfig().dark : themeConfig().light;
  const definition = themeDefinition(themeName);
  const color = definition.colors?.['bg-chrome'] ?? (dark ? '#161a17' : '#f2efe7');
  return {
    color,
    symbolColor: definition.type === 'light' ? '#000000' : '#ffffff',
    height: TITLE_BAR_HEIGHT,
  };
}

function updateTitleBarOverlays(): void {
  if (process.platform === 'darwin') {
    return;
  }
  const overlay = titleBarOverlayOptions();
  for (const window of BrowserWindow.getAllWindows()) {
    window.setTitleBarOverlay(overlay);
  }
}

function createWindow(projectPath: string | null): BrowserWindow {
  const preload = fileURLToPath(new URL('../preload/index.mjs', import.meta.url));
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    title: projectPath ? `${basename(projectPath)} — Dóru` : 'Dóru',
    icon: process.platform === 'darwin' ? undefined : iconPath(),
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 14, y: 13 } }
      : {
          frame: false,
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: titleBarOverlayOptions(),
        }),
    webPreferences: {
      preload,
      sandbox: false,
      contextIsolation: true,
    },
  });
  const webContentsId = window.webContents.id;
  windowProject.set(webContentsId, projectPath);

  window.on('page-title-updated', (event) => {
    event.preventDefault();
    const bound = windowProject.get(webContentsId);
    window.setTitle(bound ? `${basename(bound)} — Dóru` : 'Dóru');
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    void window.loadURL(rendererUrl);
  } else {
    void window.loadFile(join(fileURLToPath(new URL('..', import.meta.url)), 'renderer/index.html'));
  }

  window.on('closed', () => {
    const boundProject = windowProject.get(webContentsId);
    windowProject.delete(webContentsId);
    if (boundProject) {
      projectWindows.delete(boundProject);
      closeProjectRuntime(boundProject);
      void updateSession((session) => ({
        paths: session.paths.filter((entry) => entry !== boundProject),
        activePath: session.activePath === boundProject ? null : session.activePath,
      }));
    }
  });

  if (projectPath) {
    projectWindows.set(projectPath, window);
  }
  return window;
}

function closeProjectRuntime(projectPath: string): void {
  const runtime = runtimes.get(projectPath);
  if (runtime) {
    runtime.store.close();
    runtimes.delete(projectPath);
  }
  const acp = acpClients.get(projectPath);
  if (acp) {
    void acp.close();
    acpClients.delete(projectPath);
  }
}

async function ensureRuntime(
  projectPath: string,
): Promise<{ summary: ProjectSummary; runtime: ProjectRuntime }> {
  const existing = runtimes.get(projectPath);
  if (existing) {
    return {
      summary: {
        path: projectPath,
        schemaVersion: existing.store.userVersion(),
        created: false,
      },
      runtime: existing,
    };
  }
  const { summary, store } = await opener.open(projectPath);
  const repo = new SqliteTreeRepository(store.db);
  const queue = new OpQueue();
  const runtime: ProjectRuntime = { store, repo, queue };
  runtimes.set(summary.path, runtime);
  return { summary, runtime };
}

async function openProject(
  options: { dialog?: boolean; path?: string },
  senderId?: number,
): Promise<ProjectSummary | null> {
  let filePath = options.path;
  if (!filePath) {
    const dialogOptions: OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'Dóru project', extensions: ['doru'] }],
      title: 'Open Project',
    };
    const parent = focusedWindow();
    const result =
      parent !== null
        ? await dialog.showOpenDialog(parent, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || result.filePaths[0] === undefined) {
      return null;
    }
    filePath = result.filePaths[0];
  }
  if (!filePath.toLowerCase().endsWith(TREE_FILE_EXTENSION)) {
    return null;
  }
  const existingWindow = projectWindows.get(filePath);
  if (existingWindow) {
    if (existingWindow.isDestroyed()) {
      projectWindows.delete(filePath);
    } else {
      if (existingWindow.isMinimized()) {
        existingWindow.restore();
      }
      existingWindow.focus();
      return {
        path: filePath,
        schemaVersion: runtimes.get(filePath)?.store.userVersion() ?? 0,
        created: false,
      };
    }
  }
  const { summary } = await ensureRuntime(filePath);
  const senderWindow = senderId !== undefined ? windowById(senderId) : null;
  const senderBound = senderId !== undefined ? windowProject.get(senderId) : undefined;
  if (senderWindow && !senderWindow.isDestroyed() && senderBound === null) {
    bindWindowToProject(senderWindow, filePath);
  } else if (senderId === undefined) {
    const emptyWindow =
      BrowserWindow.getAllWindows().find(
        (window) => !window.isDestroyed() && windowProject.get(window.webContents.id) === null,
      ) ?? null;
    if (emptyWindow) {
      bindWindowToProject(emptyWindow, filePath);
    } else {
      createWindow(filePath);
    }
  } else {
    createWindow(filePath);
  }
  if (recents) {
    await recents.touch(summary.path);
    await updateSession((session) => {
      const paths = session.paths.filter((entry) => entry !== summary.path);
      return { paths: [...paths, summary.path], activePath: summary.path };
    });
  }
  return summary;
}

async function createProject(senderId?: number): Promise<ProjectSummary | null> {
  const dialogOptions: SaveDialogOptions = {
    filters: [{ name: 'Dóru project', extensions: ['doru'] }],
    title: 'Create New Project',
    buttonLabel: 'Create',
    defaultPath: 'Family Tree.doru',
  };
  const result =
    focusedWindow() !== null
      ? await dialog.showSaveDialog(focusedWindow() as BrowserWindow, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);
  if (result.canceled || !result.filePath) {
    return null;
  }
  const filePath = result.filePath.toLowerCase().endsWith(TREE_FILE_EXTENSION)
    ? result.filePath
    : `${result.filePath}${TREE_FILE_EXTENSION}`;
  return openProject({ path: filePath }, senderId);
}

function openExternalPath(path: string): void {
  if (!path.toLowerCase().endsWith(TREE_FILE_EXTENSION)) {
    return;
  }
  void openProject({ path });
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
      focusedWindow() !== null
        ? await dialog.showOpenDialog(focusedWindow() as BrowserWindow, dialogOptions)
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
  const op = importGedcomOp(filePath, doc);
  runtime.queue.apply(op, { repo: runtime.repo });
  return {
    importedPersons: op.insertedPersons.length,
    importedFamilies: op.insertedFamilies.length,
    totalPersons: runtime.repo.countPersons(),
  };
}

type ResolvedAiConfig = {
  preset: AiProviderPreset;
  baseUrl: string;
  apiKey: string;
  model: string;
  acpCommand: string;
  acpArgs: string[];
  mcpServers: McpServerConfig[];
  configured: boolean;
};

function configFilePath(): string {
  return join(app.getPath('userData'), AI_CONFIG_FILE);
}

function loadAiConfig(): ResolvedAiConfig {
  const file = configFilePath();
  if (!existsSync(file)) {
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(file, DEFAULT_AI_CONFIG);
  }
  const text = readFileSync(file, 'utf8');
  const parsed = parse(text) as {
    ai?: {
      provider?: string;
      baseUrl?: string;
      apiKey?: string;
      apiKeyEncrypted?: string;
      model?: string;
      command?: string;
      args?: string[];
    };
    mcp?: { servers?: McpServerConfig[] };
  };
  const ai = parsed.ai ?? {};

  const presetId = ai.provider ?? 'openai';
  const preset = findProvider(presetId);

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

  const baseUrl = ai.baseUrl ?? preset.defaultBaseUrl ?? '';
  const model = process.env.DORU_AI_MODEL ?? ai.model ?? '';
  const acpCommand = ai.command ?? '';
  const acpArgs = ai.args ?? [];
  const mcpServers = parsed.mcp?.servers ?? [];

  const configured =
    preset.dialect === 'acp'
      ? acpCommand !== ''
      : model !== '' && baseUrl !== '' && (!preset.requiresKey || apiKey !== '');

  return { preset, baseUrl, apiKey, model, acpCommand, acpArgs, mcpServers, configured };
}

function writeAiConfig(edits: Array<{ path: (string | number)[]; value?: unknown }>): void {
  const file = configFilePath();
  loadAiConfig();
  let text = readFileSync(file, 'utf8');
  for (const edit of edits) {
    const next = modify(text, edit.path, edit.value, { formattingOptions: { insertSpaces: true, tabSize: 2 } });
    text = applyEdits(text, next);
  }
  writeFileSync(file, text);
}

function aiSettingsPayload(config: ResolvedAiConfig): {
  provider: string;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  acpCommand: string;
  acpArgs: string[];
  configured: boolean;
} {
  return {
    provider: config.preset.id,
    baseUrl: config.baseUrl,
    model: config.model,
    hasKey: config.apiKey !== '',
    acpCommand: config.acpCommand,
    acpArgs: config.acpArgs,
    configured: config.configured,
  };
}

function requestPermission(projectPath: string, tool: string, args: Record<string, unknown>): Promise<boolean> {
  const id = crypto.randomUUID();
  projectWindows.get(projectPath)?.webContents.send('chat:permission', { id, tool, arguments: args });
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      pendingPermissions.delete(id);
      resolve(false);
    }, 120_000);
    pendingPermissions.set(id, { resolve, timer });
  });
}

function doruMcpServerEntry(projectPath: string): AcpMcpServerEntry {
  const args = app.isPackaged
    ? ['--mcp-server', projectPath]
    : [resolve(process.argv[1] ?? '.'), '--mcp-server', projectPath];
  return { name: 'doru', command: process.execPath, args };
}

const acpClients = new Map<string, AcpAgentClient>();

async function ensureAcpClient(projectPath: string, config: ResolvedAiConfig): Promise<AcpAgentClient> {
  const existing = acpClients.get(projectPath);
  if (existing) {
    return existing;
  }
  const client = new AcpAgentClient({
    command: config.acpCommand,
    args: config.acpArgs,
    cwd: dirname(projectPath),
    mcpServers: [
      doruMcpServerEntry(projectPath),
      ...config.mcpServers.map((server) => ({
        name: server.name,
        command: server.command,
        args: server.args,
        env: server.env,
      })),
    ],
  });
  await client.start((tool, args) => requestPermission(projectPath, tool, args));
  acpClients.set(projectPath, client);
  return client;
}

async function sendChat(options: { projectPath: string; messages: ChatMessage[] }): Promise<ChatSendResult> {
  const config = loadAiConfig();
  if (!config.configured) {
    return {
      steps: [],
      finalText: '',
      error: `AI provider is not configured. Open the settings (gear icon) to set it up.`,
    };
  }
  const { runtime } = await ensureRuntime(options.projectPath);
  const lastUser = [...options.messages].reverse().find((message) => message.role === 'user');

  const systemMessage: ChatMessage = {
    role: 'system',
    content:
      'You are a genealogy assistant working with the user\'s family tree. ' +
      'Use tree_stats to see how large the tree is, and tree_query without a query to list persons. ' +
      'Wildcards are not needed: an empty query already lists the tree. ' +
      'For edits, use tree_edit.',
  };
  const conversation = [systemMessage, ...options.messages];

  if (config.preset.dialect === 'acp') {
    try {
      const client = await ensureAcpClient(options.projectPath, config);
      const result = await client.prompt(lastUser?.content ?? '');
      return { steps: result.steps, finalText: result.finalText };
    } catch (error) {
      return {
        steps: [],
        finalText: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const backend = new TreeMcpBackend(runtime.repo, runtime.queue);
  const model =
    config.preset.dialect === 'anthropic'
      ? new AnthropicChatConnector({ baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model })
      : new OpenAIChatConnector({ baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model });

  let host: McpHostManager | null = null;
  if (config.mcpServers.length > 0) {
    host = new McpHostManager(config.mcpServers);
    await host.connectAll();
  }
  const extraTools = host?.externalTools() ?? [];
  const extraInvoke = host ? (name: string, args: Record<string, unknown>) => host.invoke(name, args) : null;
  const agent = new AgentRuntime(
    model,
    backend,
    (tool, args) => requestPermission(options.projectPath, tool, args),
    DEFAULT_PERMISSION_POLICY,
    extraTools,
    extraInvoke,
  );
  try {
    const result = await agent.run(conversation);
    return { steps: result.steps, finalText: result.finalText };
  } catch (error) {
    return {
      steps: [],
      finalText: '',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (host) {
      await host.closeAll();
    }
  }
}

ipcMain.handle(
  'project:open',
  (event, options: { dialog?: boolean; path?: string } = {}) => openProject(options, event.sender.id),
);

ipcMain.handle('project:create', (event) => createProject(event.sender.id));

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

ipcMain.handle('project:current', (event) => windowProject.get(event.sender.id) ?? null);

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
  runtime.queue.apply(addPersonOp(options.person), { repo: runtime.repo });
  return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
});

ipcMain.handle(
  'tree:updatePerson',
  async (_event, options: { projectPath: string; before: PersonRecord; after: PersonRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    runtime.queue.apply(updatePersonOp(options.before, options.after), { repo: runtime.repo });
    return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
  },
);

ipcMain.handle('project:export', async (_event, options: { projectPath: string }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  const dialogOptions: SaveDialogOptions = {
    defaultPath: join(dirname(options.projectPath), `${basename(options.projectPath).replace(/\.doru$/i, '')}.ged`),
    filters: [{ name: 'GEDCOM', extensions: ['ged'] }],
    title: 'Export GEDCOM',
  };
  const result =
    focusedWindow() !== null
      ? await dialog.showSaveDialog(focusedWindow() as BrowserWindow, dialogOptions)
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

ipcMain.handle('theme:css', (_event, options: { name: string }) => themeCss(options.name));

interface ThemeInfo {
  name: string;
  type: 'dark' | 'light';
}

function themesDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'themes')
    : resolve(app.getAppPath(), '..', '..', 'themes');
}

function listBuiltinThemes(): ThemeInfo[] {
  try {
    const root = themesDir();
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .map((name) => {
        try {
          const definition = themeDefinition(name);
          return {
            name: definition.name ?? name,
            type: definition.type === 'light' ? 'light' : 'dark',
          } as ThemeInfo;
        } catch {
          return null;
        }
      })
      .filter((theme): theme is ThemeInfo => theme !== null);
  } catch {
    return [];
  }
}

function themeConfig(): { dark: string; light: string } {
  try {
    const parsed = parse(readFileSync(join(app.getPath('userData'), AI_CONFIG_FILE), 'utf8')) as {
      theme?: { dark?: string; light?: string };
    };
    const theme = parsed.theme ?? {};
    return { dark: theme.dark ?? DEFAULT_DARK_THEME, light: theme.light ?? DEFAULT_LIGHT_THEME };
  } catch {
    return { dark: DEFAULT_DARK_THEME, light: DEFAULT_LIGHT_THEME };
  }
}

function themeCss(name: string): string {
  const colors = themeDefinition(name).colors ?? {};
  const lines = Object.entries(colors).map(([key, value]) => `  --doru-${key}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}\n`;
}

ipcMain.handle('theme:state', () => ({
  systemDark: nativeTheme.shouldUseDarkColors,
  config: themeConfig(),
  themes: listBuiltinThemes(),
}));

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
  runtime.queue.apply(addNoteOp(options.note), { repo: runtime.repo });
  return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
});

ipcMain.handle('tree:families', async (_event, options: { projectPath: string }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  return runtime.repo.listFamilies();
});

ipcMain.handle('tree:addFamily', async (_event, options: { projectPath: string; family: FamilyRecord }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  runtime.queue.apply(addFamilyOp(options.family), { repo: runtime.repo });
  return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
});

ipcMain.handle(
  'tree:updateFamily',
  async (_event, options: { projectPath: string; before: FamilyRecord; after: FamilyRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    runtime.queue.apply(updateFamilyOp(options.before, options.after), { repo: runtime.repo });
    return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
  },
);

ipcMain.handle('tree:deleteFamily', async (_event, options: { projectPath: string; family: FamilyRecord }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  runtime.queue.apply(deleteFamilyOp(options.family), { repo: runtime.repo });
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
    runtime.queue.apply(addSourceOp(options.source, citation), { repo: runtime.repo });
    return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
  },
);

ipcMain.handle('tree:attachSource', async (_event, options: { projectPath: string; sourceId: string; targetType: string; targetId: string }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  runtime.queue.apply(
    attachCitationOp({
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
    runtime.queue.apply(detachCitationOp(citation), { repo: runtime.repo });
  }
  return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
});

ipcMain.handle(
  'tree:events',
  async (_event, options: { projectPath: string; personId?: string; familyId?: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    if (options.personId) {
      return runtime.repo.listEventsForPerson(options.personId);
    }
    if (options.familyId) {
      return runtime.repo.listEventsForFamily(options.familyId);
    }
    return [];
  },
);

ipcMain.handle('tree:addEvent', async (_event, options: { projectPath: string; event: EventRecord }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  runtime.queue.apply(addEventOp(options.event), { repo: runtime.repo });
  return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
});

ipcMain.handle('tree:deleteEvent', async (_event, options: { projectPath: string; event: EventRecord }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  runtime.queue.apply(deleteEventOp(options.event), { repo: runtime.repo });
  return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
});

ipcMain.handle('tree:media', async (_event, options: { projectPath: string; personId: string }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  return runtime.repo
    .listMediaFor('person', options.personId)
    .map((media) => ({ ...media, absolutePath: join(dirname(options.projectPath), media.path) }));
});

ipcMain.handle('tree:addMedia', async (_event, options: { projectPath: string; personId: string }) => {
  const dialogOptions: OpenDialogOptions = {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'tiff'] }],
    title: 'Add photos',
  };
  const result =
    focusedWindow() !== null
      ? await dialog.showOpenDialog(focusedWindow() as BrowserWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }
  const { runtime } = await ensureRuntime(options.projectPath);
  const mediaDir = join(dirname(options.projectPath), MEDIA_DIR_NAME);
  await fs.mkdir(mediaDir);
  const added: Array<MediaRecord & { absolutePath: string }> = [];
  for (const source of result.filePaths) {
    const name = `${randomUUID()}${extname(source)}`;
    const destination = join(mediaDir, name);
    await fs.copyFile(source, destination);
    const media: MediaRecord = {
      id: randomUUID(),
      path: join(MEDIA_DIR_NAME, name),
      targetType: 'person',
      targetId: options.personId,
    };
    runtime.queue.apply(addMediaOp(media), { repo: runtime.repo });
    added.push({ ...media, absolutePath: destination });
  }
  return added;
});

ipcMain.handle('tree:deleteMedia', async (_event, options: { projectPath: string; media: MediaRecord }) => {
  const { runtime } = await ensureRuntime(options.projectPath);
  runtime.queue.apply(deleteMediaOp(options.media), { repo: runtime.repo });
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

ipcMain.handle('settings:ai:get', () => aiSettingsPayload(loadAiConfig()));

ipcMain.handle('settings:ai:providers', () =>
  AI_PROVIDERS.map((preset) => ({
    id: preset.id,
    label: preset.label,
    dialect: preset.dialect,
    defaultBaseUrl: preset.defaultBaseUrl ?? '',
    defaultModels: preset.defaultModels,
    requiresKey: preset.requiresKey,
  })),
);

ipcMain.handle(
  'settings:ai:set',
  (_event, options: {
    provider?: string;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    clearKey?: boolean;
    acpCommand?: string;
    acpArgs?: string[];
  }) => {
    const edits: Array<{ path: (string | number)[]; value?: unknown }> = [];
    if (options.provider !== undefined) {
      edits.push({ path: ['ai', 'provider'], value: options.provider });
    }
    if (options.baseUrl !== undefined) {
      edits.push({ path: ['ai', 'baseUrl'], value: options.baseUrl });
    }
    if (options.model !== undefined) {
      edits.push({ path: ['ai', 'model'], value: options.model });
    }
    if (options.acpCommand !== undefined) {
      edits.push({ path: ['ai', 'command'], value: options.acpCommand });
    }
    if (options.acpArgs !== undefined) {
      edits.push({ path: ['ai', 'args'], value: options.acpArgs });
    }
    if (options.clearKey) {
      edits.push({ path: ['ai', 'apiKeyEncrypted'] });
      edits.push({ path: ['ai', 'apiKey'] });
    } else if (options.apiKey !== undefined && options.apiKey !== '') {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('OS keychain is not available');
      }
      edits.push({
        path: ['ai', 'apiKeyEncrypted'],
        value: safeStorage.encryptString(options.apiKey).toString('base64'),
      });
      edits.push({ path: ['ai', 'apiKey'] });
    }
    if (edits.length > 0) {
      writeAiConfig(edits);
    }
    return aiSettingsPayload(loadAiConfig());
  },
);

function configWithOverrides(overrides: {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}): ResolvedAiConfig {
  const config = loadAiConfig();
  const preset = overrides.provider ? findProvider(overrides.provider) : config.preset;
  const providerChanged = overrides.provider !== undefined && overrides.provider !== config.preset.id;
  return {
    ...config,
    preset,
    baseUrl:
      overrides.baseUrl ??
      (providerChanged ? (preset.defaultBaseUrl ?? '') : config.baseUrl),
    apiKey: overrides.apiKey !== undefined ? overrides.apiKey : config.apiKey,
    model: overrides.model ?? config.model,
  };
}

ipcMain.handle('settings:ai:test', async (_event, options: {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
} = {}) => {
  const config = configWithOverrides(options);
  if (config.preset.dialect === 'acp') {
    return { ok: config.acpCommand !== '', error: config.acpCommand !== '' ? undefined : 'ACP command is not set' };
  }
  if (!config.model) {
    return { ok: false, error: 'Model is not set' };
  }
  if (!config.baseUrl) {
    return { ok: false, error: 'Base URL is not set' };
  }
  if (config.preset.requiresKey && !config.apiKey) {
    return { ok: false, error: 'API key is not set' };
  }
  try {
    const model =
      config.preset.dialect === 'anthropic'
        ? new AnthropicChatConnector({ baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model })
        : new OpenAIChatConnector({ baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model });
    await model.complete([{ role: 'user', content: 'ping' }], []);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('settings:ai:models', async (_event, options: {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
} = {}) => {
  const config = configWithOverrides(options);
  if (config.preset.dialect === 'acp' || !config.baseUrl || !config.apiKey) {
    return { models: [] as string[], error: 'Provider is not configured' };
  }
  try {
    if (config.preset.dialect === 'anthropic') {
      const response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/v1/models`, {
        headers: { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' },
      });
      if (!response.ok) {
        return { models: [] as string[], error: `HTTP ${response.status}` };
      }
      const data = (await response.json()) as { data?: Array<{ id: string }> };
      return { models: (data.data ?? []).map((model) => model.id) };
    }
    const response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/models`, {
      headers: { authorization: `Bearer ${config.apiKey}` },
    });
    if (!response.ok) {
      return { models: [] as string[], error: `HTTP ${response.status}` };
    }
    const data = (await response.json()) as { data?: Array<{ id: string }> };
    return { models: (data.data ?? []).map((model) => model.id) };
  } catch (error) {
    return { models: [] as string[], error: error instanceof Error ? error.message : String(error) };
  }
});

protocol.registerSchemesAsPrivileged([
  { scheme: 'doru-media', privileges: { secure: true, stream: true } },
]);

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
    const target =
      BrowserWindow.getFocusedWindow() ??
      projectWindows.values().next().value ??
      BrowserWindow.getAllWindows()[0] ??
      null;
    if (target) {
      if (target.isMinimized()) {
        target.restore();
      }
      target.focus();
    }
    for (const path of extractPathArgs(argv)) {
      if (path.startsWith('doru://')) {
        handleProtocolUrl(path);
      } else {
        openExternalPath(path);
      }
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
  installMenu();

  if (process.platform === 'darwin' && app.dock && !app.isPackaged) {
    try {
      app.dock.setIcon(iconPath());
    } catch {
      log.warn('could not set the dock icon');
    }
  }

  protocol.handle('doru-media', (request) => {
    try {
      const url = new URL(request.url);
      const filePath = url.searchParams.get('path');
      if (!filePath) {
        return new Response('not found', { status: 404 });
      }
      return net.fetch(pathToFileURL(filePath).toString());
    } catch {
      return new Response('not found', { status: 404 });
    }
  });

  nativeTheme.on('updated', () => {
    updateTitleBarOverlays();
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('theme:system-changed', { systemDark: nativeTheme.shouldUseDarkColors });
    }
  });
  try {
    const configWatcher = watch(join(app.getPath('userData'), AI_CONFIG_FILE), () => {
      updateTitleBarOverlays();
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('theme:config-changed', themeConfig());
      }
    });
    configWatcher.unref();
  } catch {
    log.warn('could not watch the app config file');
  }

  const mcpProject = parseMcpServerArg(process.argv);
  if (mcpProject) {
    const { runtime } = await ensureRuntime(mcpProject);
    const backend = new TreeMcpBackend(runtime.repo, runtime.queue);
    const server = new DoruMcpServer(backend, app.getVersion());
    await server.connect(new StdioServerTransport());
    log.info(`Dóru MCP server started for ${mcpProject}`);
    return;
  }

  const argvPaths = [...extractPathArgs(process.argv), ...pendingExternalPaths];
  if (argvPaths.length > 0) {
    for (const path of argvPaths) {
      if (path.startsWith('doru://')) {
        handleProtocolUrl(path);
      } else {
        openExternalPath(path);
      }
    }
  } else {
    const session = readSession();
    for (const path of session.paths) {
      await openProject({ path });
    }
    const activePath = session.activePath;
    if (activePath) {
      await openProject({ path: activePath });
      projectWindows.get(activePath)?.focus();
    }
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(null);
    }
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(null);
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

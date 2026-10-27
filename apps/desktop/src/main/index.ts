import { BrowserWindow, app, nativeTheme, net, protocol } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DoruMcpServer, TreeMcpBackend } from '@doru/ai';
import { RecentProjects } from '@doru/core';
import { watchSettings } from './settings';
import { registerChatIpc } from './ipc-chat';
import { registerProjectIpc } from './ipc-project';
import { broadcastAiSettingsChanged, registerSettingsIpc } from './ipc-settings';
import { registerThemeIpc } from './ipc-theme';
import { registerTreeIpc } from './ipc-tree';
import { log } from './log';
import { NodeFileSystem } from './filesystem';
import { openExternalPath, openProject } from './projects';
import { parseProtocolUrl } from './protocol-url';
import { closeAllRuntimes, ensureRuntime } from './runtime';
import { readSession } from './session';
import { pendingExternalPaths, projectWindows, recents } from './state';
import { ensureUserThemesDir, themeState, updateTitleBarOverlays, updateWindowBackgrounds, watchUserThemes } from './themes';
import { createWindow, iconPath, installMenu } from './windows';

if (process.env['DORU_USER_DATA']) {
  app.setPath('userData', process.env['DORU_USER_DATA']);
}

registerProjectIpc();
registerTreeIpc();
registerChatIpc();
registerSettingsIpc();
registerThemeIpc();

protocol.registerSchemesAsPrivileged([
  { scheme: 'doru-media', privileges: { secure: true, stream: true } },
]);

function handleProtocolUrl(url: string): void {
  const projectPath = parseProtocolUrl(url);
  if (projectPath === null) {
    log.warn('malformed protocol url', url);
    return;
  }
  if (app.isReady()) {
    openExternalPath(projectPath);
  } else {
    pendingExternalPaths.push(projectPath);
  }
}

/**
 * Makes `setAsDefaultProtocolClient` work on Linux (Electron 44).
 *
 * Electron registers the scheme through g_app_info_set_as_default_for_type,
 * which identifies the app by the CHROME_DESKTOP environment variable — but
 * Electron never sets that variable itself (Chromium sets it only in its
 * ChromeBrowserMainParts, which Electron does not use). Without it the
 * registration silently does nothing and doru:// links never resolve.
 * The desktop entry is normally provided by the install channel (the
 * Homebrew cask writes org.doru.doru.desktop); for bare AppImage installs a
 * minimal entry is written here instead. The default-handler association is
 * then written to mimeapps.list directly — the file xdg-open consults —
 * instead of relying on GIO's desktop lookup. Flatpak registration happens
 * through the desktop entry exported to the host, so the sandbox is skipped.
 */
function prepareLinuxProtocolRegistration(): void {
  if (process.platform !== 'linux' || process.env['FLATPAK_ID']) {
    return;
  }
  const dataHome = process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share');
  const desktopFile = join(dataHome, 'applications', 'org.doru.doru.desktop');
  if (!existsSync(desktopFile)) {
    mkdirSync(dirname(desktopFile), { recursive: true });
    // In dev the executable is the Electron binary itself and needs the app
    // directory as an argument to launch anything.
    const devArg =
      process.defaultApp && process.argv[1] ? ` "${process.argv[1].replace(/"/g, '\\"')}"` : '';
    writeFileSync(
      desktopFile,
      [
        '[Desktop Entry]',
        'Name=Dóru',
        `Exec="${process.execPath}"${devArg} %U`,
        'Terminal=false',
        'Type=Application',
        'MimeType=x-scheme-handler/doru;',
        '',
      ].join('\n'),
    );
  }
  // Electron's registration reads CHROME_DESKTOP, which Electron never sets
  // itself — point it at the desktop entry explicitly.
  process.env['CHROME_DESKTOP'] = 'org.doru.doru.desktop';
  const configHome = process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config');
  const mimeappsFile = join(configHome, 'mimeapps.list');
  const entry = 'x-scheme-handler/doru=org.doru.doru.desktop';
  const existing = existsSync(mimeappsFile) ? readFileSync(mimeappsFile, 'utf8') : '';
  const lines = existing.split('\n').filter((line) => {
    const trimmed = line.trim();
    return trimmed !== entry && !trimmed.startsWith('x-scheme-handler/doru=');
  });
  while (lines[lines.length - 1] === '') {
    lines.pop();
  }
  if (!lines.some((line) => line.trim() === '[Default Applications]')) {
    lines.push('[Default Applications]');
  }
  lines.push(entry);
  writeFileSync(mimeappsFile, `${lines.join('\n')}\n`);
  log.info('registered doru:// as the default scheme handler', { desktopFile, mimeappsFile });
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

// MCP server mode (`--mcp-server`) is a headless helper process that ACP
// agents and external MCP clients spawn next to the GUI. It shares the
// userData with the GUI, so it must not fight it over the single-instance
// lock, and it must stay completely headless: no protocol registration, no
// file/open events, no menu, no dock icon, no windows — otherwise file opens
// and dock activations land in the helper and it turns into a surprise
// second app instance.
const mcpProject = parseMcpServerArg(process.argv);

const gotLock = mcpProject !== null || app.requestSingleInstanceLock();
if (!gotLock) {
  // A running instance received the second-instance event with our argv and
  // opens the link/file itself. Register no startup or teardown hooks here:
  // Electron defers a pre-ready quit() until after the ready event, so
  // anything registered below would run in the quitting instance too — its
  // window-close teardown used to overwrite the running instance's
  // session.json with an empty session.
  app.quit();
} else if (!mcpProject) {
  // The doru:// protocol scheme — keep in sync with executableName in
  // electron-builder.yml.
  prepareLinuxProtocolRegistration();
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

if (gotLock) {
  void app.whenReady().then(startApp);

  app.on('will-quit', () => {
    closeAllRuntimes();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

async function startApp(): Promise<void> {
  if (mcpProject) {
    // Headless helper: open the tree, serve the shared toolset over stdio,
    // and stay out of everything GUI (no menu, no dock icon, no windows).
    app.dock?.hide();
    const { runtime } = await ensureRuntime(mcpProject);
    const backend = new TreeMcpBackend(runtime.repo, runtime.queue);
    const server = new DoruMcpServer(backend, app.getVersion());
    await server.connect(new StdioServerTransport());
    log.info(`Dóru MCP server started for ${mcpProject}`);
    return;
  }

  ensureUserThemesDir();
  const fs = new NodeFileSystem();
  recents.current = new RecentProjects(fs, join(app.getPath('userData'), 'recent.json'));
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
    updateWindowBackgrounds();
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('theme:system-changed', { systemDark: nativeTheme.shouldUseDarkColors });
    }
  });
  // Settings.json edits and theme-file edits (drop/add/edit in the user
  // themes folder) both re-apply the theme live: window chrome plus the
  // renderer-side theme list and CSS.
  const onThemeChanged = (): void => {
    updateTitleBarOverlays();
    updateWindowBackgrounds();
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('theme:settings-changed', themeState());
    }
  };
  watchSettings(() => {
    onThemeChanged();
    broadcastAiSettingsChanged();
  });
  watchUserThemes(onThemeChanged);

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
}

import { BrowserWindow, app, nativeTheme, net, protocol } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DoruMcpServer, TreeMcpBackend } from '@doru/ai';
import { RecentProjects } from '@doru/core';
import { watchSettings } from './settings';
import { registerChatIpc } from './ipc-chat';
import { registerProjectIpc } from './ipc-project';
import { registerSettingsIpc } from './ipc-settings';
import { registerThemeIpc } from './ipc-theme';
import { registerTreeIpc } from './ipc-tree';
import { log } from './log';
import { NodeFileSystem } from './filesystem';
import { openExternalPath, openProject } from './projects';
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
  app.quit();
} else if (!mcpProject) {
  // The doru:// protocol scheme — keep in sync with executableName in
  // electron-builder.yml.
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

void app.whenReady().then(async () => {
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
  watchSettings(onThemeChanged);
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
});

app.on('will-quit', () => {
  closeAllRuntimes();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

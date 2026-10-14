import { BrowserWindow, app, nativeTheme, net, protocol } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DoruMcpServer, TreeMcpBackend } from '@doru/ai';
import { RecentProjects } from '@doru/core';
import { watchConfig } from './config';
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
import { themeConfig, updateTitleBarOverlays, updateWindowBackgrounds } from './themes';
import { createWindow, iconPath, installMenu } from './windows';

if (process.env.DORU_USER_DATA) {
  app.setPath('userData', process.env.DORU_USER_DATA);
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

void app.whenReady().then(async () => {
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
  watchConfig(() => {
    updateTitleBarOverlays();
    updateWindowBackgrounds();
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('theme:config-changed', themeConfig());
    }
  });

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
  closeAllRuntimes();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

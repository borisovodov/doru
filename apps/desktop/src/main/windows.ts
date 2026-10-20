import { BrowserWindow, Menu, app, type MenuItemConstructorOptions } from 'electron';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProjectBinding } from '@doru/core';
import { closeProjectRuntime } from './runtime';
import { updateSession } from './session';
import { projectWindows, untitledProjects, windowProject } from './state';
import { titleBarOverlayOptions, windowBackgroundColor } from './themes';

export function iconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'icon.png');
  }
  // In development on macOS, use the PNG extracted from the icns that
  // electron-builder generates from the Icon Composer project, so the dock
  // icon matches the packaged app. Electron's nativeImage cannot load .icns
  // files directly. Run `npm run icon:mac -w @doru/desktop` to regenerate.
  return process.platform === 'darwin'
    ? join(app.getAppPath(), 'build', 'icon-dev.png')
    : join(app.getAppPath(), 'resources', 'icon.png');
}

export function focusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow();
}

export function windowById(id: number): BrowserWindow | null {
  return (
    BrowserWindow.getAllWindows().find(
      (window) => !window.isDestroyed() && window.webContents.id === id,
    ) ?? null
  );
}

/**
 * The renderer-facing identity of a project key: a real `.doru` path, or an
 * `untitled:` id carrying the imported file name.
 */
export function bindingOf(projectKey: string): ProjectBinding {
  const untitled = untitledProjects.get(projectKey);
  if (untitled) {
    return { path: projectKey, untitled: true, name: untitled.name };
  }
  return { path: projectKey, untitled: false, name: basename(projectKey) };
}

export function installMenu(): void {
  const template: MenuItemConstructorOptions[] = [];
  if (process.platform === 'darwin') {
    template.push({ role: 'appMenu' });
  } else {
    template.push({ label: 'File', submenu: [{ role: 'quit' }] });
  }
  template.push({ role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

export function bindWindowToProject(window: BrowserWindow, projectKey: string): void {
  const binding = bindingOf(projectKey);
  windowProject.set(window.webContents.id, projectKey);
  projectWindows.set(projectKey, window);
  window.setTitle(`${binding.name} — Dóru`);
  window.webContents.send('project:bind', binding);
}

/**
 * Attaches an open project to a window: reuses the sender window when it is
 * an unbound (welcome) window, otherwise reuses any unbound window, and only
 * then creates a new one. Mirrors the one-window-per-project invariant.
 */
export function openProjectInWindow(projectKey: string, senderId?: number): BrowserWindow {
  const senderWindow = senderId !== undefined ? windowById(senderId) : null;
  const senderBound = senderId !== undefined ? windowProject.get(senderId) : undefined;
  if (senderWindow && !senderWindow.isDestroyed() && senderBound === null) {
    bindWindowToProject(senderWindow, projectKey);
    return senderWindow;
  }
  if (senderId === undefined) {
    const emptyWindow =
      BrowserWindow.getAllWindows().find(
        (window) => !window.isDestroyed() && windowProject.get(window.webContents.id) === null,
      ) ?? null;
    if (emptyWindow) {
      bindWindowToProject(emptyWindow, projectKey);
      return emptyWindow;
    }
  }
  return createWindow(projectKey);
}

export function createWindow(projectKey: string | null): BrowserWindow {
  const preload = fileURLToPath(new URL('../preload/index.mjs', import.meta.url));
  const icon = process.platform === 'darwin' ? undefined : iconPath();
  const title = projectKey ? `${bindingOf(projectKey).name} — Dóru` : 'Dóru';
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    title,
    ...(icon ? { icon } : {}),
    // Match the shell color so live window resizes never flash the default
    // white native surface under the content.
    backgroundColor: windowBackgroundColor(),
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
  windowProject.set(webContentsId, projectKey);

  window.on('page-title-updated', (event) => {
    event.preventDefault();
    const bound = windowProject.get(webContentsId);
    window.setTitle(bound ? `${bindingOf(bound).name} — Dóru` : 'Dóru');
  });

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
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
      updateSession((session) => ({
        paths: session.paths.filter((entry) => entry !== boundProject),
        activePath: session.activePath === boundProject ? null : session.activePath,
      }));
    }
  });

  if (projectKey) {
    projectWindows.set(projectKey, window);
  }
  return window;
}

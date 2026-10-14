import { BrowserWindow, Menu, app, type MenuItemConstructorOptions } from 'electron';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeProjectRuntime } from './runtime';
import { updateSession } from './session';
import { projectWindows, windowProject } from './state';
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

export function bindWindowToProject(window: BrowserWindow, projectPath: string): void {
  windowProject.set(window.webContents.id, projectPath);
  projectWindows.set(projectPath, window);
  window.setTitle(`${basename(projectPath)} — Dóru`);
  window.webContents.send('project:bind', { path: projectPath });
}

export function createWindow(projectPath: string | null): BrowserWindow {
  const preload = fileURLToPath(new URL('../preload/index.mjs', import.meta.url));
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    title: projectPath ? `${basename(projectPath)} — Dóru` : 'Dóru',
    icon: process.platform === 'darwin' ? undefined : iconPath(),
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
      updateSession((session) => ({
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

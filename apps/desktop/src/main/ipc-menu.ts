import { BrowserWindow, app, ipcMain } from 'electron';
import type { MenuAction } from '@doru/platform';
import { createWindow } from './windows';

/**
 * Performs a main-process menu action on `window`. These are the
 * Windows/Linux counterparts of the native roles the macOS menu renders.
 */
export function performMenuAction(window: BrowserWindow | null, action: MenuAction): void {
  if (action === 'app.quit') {
    app.quit();
    return;
  }
  // A new window needs no source window, so it is handled before the null
  // check: the command may arrive when the last window just closed.
  if (action === 'window.new') {
    createWindow(null);
    return;
  }
  if (!window || window.isDestroyed()) {
    return;
  }
  const contents = window.webContents;
  switch (action) {
    case 'edit.cut':
      contents.cut();
      return;
    case 'edit.copy':
      contents.copy();
      return;
    case 'edit.paste':
      contents.paste();
      return;
    case 'edit.selectAll':
      contents.selectAll();
      return;
    case 'view.reload':
      window.reload();
      return;
    case 'view.forceReload':
      contents.reloadIgnoringCache();
      return;
    case 'view.toggleDevTools':
      contents.toggleDevTools();
      return;
    case 'view.resetZoom':
      contents.setZoomLevel(0);
      return;
    case 'view.zoomIn':
      contents.setZoomLevel(contents.getZoomLevel() + 0.5);
      return;
    case 'view.zoomOut':
      contents.setZoomLevel(contents.getZoomLevel() - 0.5);
      return;
    case 'view.toggleFullscreen':
      window.setFullScreen(!window.isFullScreen());
      return;
  }
}

export function registerMenuIpc(): void {
  ipcMain.handle('menu:action', (event, action: MenuAction) => {
    // Route through the window the request came from; the focused window may
    // be none under automation.
    performMenuAction(BrowserWindow.fromWebContents(event.sender), action);
  });
}

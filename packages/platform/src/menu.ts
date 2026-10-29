import type { MessageKey } from './nls';

/**
 * The application menu is described once here and rendered by two surfaces:
 * the native macOS menu bar (main process, Electron roles) and the in-window
 * menu on Windows/Linux (renderer DOM, `AppMenu`). An entry carries either a
 * renderer command, a main-process action, or both a role (macOS) and an
 * action (Windows/Linux), so one entry covers every platform.
 *
 * App commands deliberately carry no Electron accelerator: keybindings live
 * in the renderer on every platform, and a menu accelerator would run the
 * command a second time.
 */

/** Host platforms an entry can be limited to. Linux shares the windows variant. */
export type MenuPlatform = 'macos' | 'windows' | 'linux';

/** Main-process window actions that menu entries can trigger (via the `menu:action` IPC). */
export type MenuAction =
  | 'app.quit'
  | 'edit.cut'
  | 'edit.copy'
  | 'edit.paste'
  | 'edit.selectAll'
  | 'view.reload'
  | 'view.forceReload'
  | 'view.toggleDevTools'
  | 'view.resetZoom'
  | 'view.zoomIn'
  | 'view.zoomOut'
  | 'view.toggleFullscreen';

/** Electron menu roles the native macOS menu understands. */
export type MenuRole =
  | 'appMenu'
  | 'editMenu'
  | 'windowMenu'
  | 'quit'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'selectAll'
  | 'reload'
  | 'forceReload'
  | 'toggleDevTools'
  | 'resetZoom'
  | 'zoomIn'
  | 'zoomOut'
  | 'togglefullscreen';

export interface MenuItemEntry {
  readonly type: 'item';
  /** Stable identifier; surfaces and e2e tests address entries by it. */
  readonly id: string;
  /** nls key for the label. */
  readonly labelKey?: MessageKey;
  /** Renderer command executed on selection through the CommandService. */
  readonly command?: string;
  /** Main-process window action executed on selection through the `menu:action` IPC. */
  readonly action?: MenuAction;
  /** Electron role; the native macOS menu renders it with native behavior. */
  readonly role?: MenuRole;
  /** Shortcut hint shown on platforms without a native menu (Ctrl+N and friends). */
  readonly hint?: string;
  readonly platforms?: readonly MenuPlatform[];
}

export interface MenuSeparatorEntry {
  readonly type: 'separator';
  readonly platforms?: readonly MenuPlatform[];
}

export type MenuEntry = MenuItemEntry | MenuSeparatorEntry;

export interface MenuGroup {
  readonly id: string;
  readonly labelKey?: MessageKey;
  /** Top-level role groups (`appMenu`, `editMenu`, `windowMenu`) are native on macOS. */
  readonly role?: 'appMenu' | 'editMenu' | 'windowMenu';
  readonly items: readonly MenuEntry[];
  readonly platforms?: readonly MenuPlatform[];
}

export const APP_MENU: readonly MenuGroup[] = [
  {
    // macOS-only: the native application menu (About, Hide, Quit…).
    id: 'app',
    role: 'appMenu',
    platforms: ['macos'],
    items: [],
  },
  {
    id: 'file',
    labelKey: 'menu.file',
    items: [
      {
        type: 'item',
        id: 'file.new',
        labelKey: 'workbench.createProject',
        command: 'workbench.createProject',
        hint: 'Ctrl+N',
      },
      {
        type: 'item',
        id: 'file.open',
        labelKey: 'workbench.openProject',
        command: 'workbench.openProject',
        hint: 'Ctrl+O',
      },
      {
        type: 'item',
        id: 'file.save',
        labelKey: 'workbench.saveProject',
        command: 'workbench.saveProject',
        hint: 'Ctrl+S',
      },
      {
        type: 'item',
        id: 'file.export',
        labelKey: 'workbench.exportGedcom',
        command: 'workbench.exportGedcom',
        hint: 'Ctrl+Shift+E',
      },
      {
        type: 'item',
        id: 'file.settings',
        labelKey: 'workbench.settings',
        command: 'workbench.openSettings',
        hint: 'Ctrl+,',
      },
      { type: 'separator', platforms: ['windows', 'linux'] },
      {
        type: 'item',
        id: 'file.quit',
        labelKey: 'menu.file.quit',
        role: 'quit',
        action: 'app.quit',
        platforms: ['windows', 'linux'],
      },
    ],
  },
  {
    // macOS renders this group as the native Edit menu; Windows/Linux render
    // its items (tree undo/redo plus native edit actions over IPC).
    id: 'edit',
    role: 'editMenu',
    items: [
      {
        type: 'item',
        id: 'edit.undo',
        labelKey: 'workbench.undo',
        command: 'tree.undo',
        hint: 'Ctrl+Z',
      },
      {
        type: 'item',
        id: 'edit.redo',
        labelKey: 'workbench.redo',
        command: 'tree.redo',
        hint: 'Ctrl+Shift+Z',
      },
      { type: 'separator' },
      {
        type: 'item',
        id: 'edit.cut',
        labelKey: 'menu.edit.cut',
        action: 'edit.cut',
        hint: 'Ctrl+X',
      },
      {
        type: 'item',
        id: 'edit.copy',
        labelKey: 'menu.edit.copy',
        action: 'edit.copy',
        hint: 'Ctrl+C',
      },
      {
        type: 'item',
        id: 'edit.paste',
        labelKey: 'menu.edit.paste',
        action: 'edit.paste',
        hint: 'Ctrl+V',
      },
      {
        type: 'item',
        id: 'edit.selectAll',
        labelKey: 'menu.edit.selectAll',
        action: 'edit.selectAll',
        hint: 'Ctrl+A',
      },
    ],
  },
  {
    id: 'view',
    labelKey: 'menu.view',
    items: [
      {
        type: 'item',
        id: 'toggle-agent-chat',
        labelKey: 'workbench.toggleAgentChat',
        command: 'workbench.toggleAgentChat',
        hint: 'Ctrl+Alt+B',
      },
      { type: 'separator' },
      {
        type: 'item',
        id: 'view.reload',
        labelKey: 'menu.view.reload',
        role: 'reload',
        action: 'view.reload',
        hint: 'Ctrl+R',
      },
      {
        type: 'item',
        id: 'view.forceReload',
        labelKey: 'menu.view.forceReload',
        role: 'forceReload',
        action: 'view.forceReload',
      },
      {
        type: 'item',
        id: 'view.toggleDevTools',
        labelKey: 'menu.view.toggleDevTools',
        role: 'toggleDevTools',
        action: 'view.toggleDevTools',
      },
      { type: 'separator' },
      {
        type: 'item',
        id: 'view.resetZoom',
        labelKey: 'menu.view.resetZoom',
        role: 'resetZoom',
        action: 'view.resetZoom',
        hint: 'Ctrl+0',
      },
      {
        type: 'item',
        id: 'view.zoomIn',
        labelKey: 'menu.view.zoomIn',
        role: 'zoomIn',
        action: 'view.zoomIn',
        hint: 'Ctrl+=',
      },
      {
        type: 'item',
        id: 'view.zoomOut',
        labelKey: 'menu.view.zoomOut',
        role: 'zoomOut',
        action: 'view.zoomOut',
        hint: 'Ctrl+-',
      },
      { type: 'separator' },
      {
        type: 'item',
        id: 'view.toggleFullscreen',
        labelKey: 'menu.view.toggleFullscreen',
        role: 'togglefullscreen',
        action: 'view.toggleFullscreen',
        hint: 'F11',
      },
    ],
  },
  {
    // macOS-only: the native Window menu (Minimize, Zoom, the window list).
    id: 'window',
    role: 'windowMenu',
    platforms: ['macos'],
    items: [],
  },
];

/** A group or entry is visible on `platform` unless it limits itself to others. */
export function menuVisible(
  entry: { readonly platforms?: readonly MenuPlatform[] },
  platform: MenuPlatform,
): boolean {
  return !entry.platforms || entry.platforms.includes(platform);
}

/** Maps a `process.platform` value to the platform the menu model speaks. */
export function menuPlatformOf(platform: string): MenuPlatform {
  if (platform === 'darwin') {
    return 'macos';
  }
  if (platform === 'win32') {
    return 'windows';
  }
  return 'linux';
}

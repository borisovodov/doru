import { ipcMain, nativeTheme } from 'electron';
import { listThemes, themeCss, themeName } from './themes';

export function registerThemeIpc(): void {
  ipcMain.handle('theme:css', (_event, options: { name: string; mode: 'dark' | 'light' }) => themeCss(options.name, options.mode));

  ipcMain.handle('theme:state', () => ({
    systemDark: nativeTheme.shouldUseDarkColors,
    config: themeName(),
    themes: listThemes(),
  }));
}

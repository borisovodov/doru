import { ipcMain, nativeTheme } from 'electron';
import { listBuiltinThemes, themeConfig, themeCss } from './themes';

export function registerThemeIpc(): void {
  ipcMain.handle('theme:css', (_event, options: { name: string }) => themeCss(options.name));

  ipcMain.handle('theme:state', () => ({
    systemDark: nativeTheme.shouldUseDarkColors,
    config: themeConfig(),
    themes: listBuiltinThemes(),
  }));
}

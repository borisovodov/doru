import { ipcMain, nativeTheme, shell } from 'electron';
import { ensureUserThemesDir, listThemes, themeCss, themeName, userThemesDir } from './themes';
import { writeSettingsEdits } from './settings';

export function registerThemeIpc(): void {
  ipcMain.handle('theme:css', (_event, options: { name: string; mode: 'dark' | 'light' }) => themeCss(options.name, options.mode));

  ipcMain.handle('theme:state', () => ({
    systemDark: nativeTheme.shouldUseDarkColors,
    theme: themeName(),
    themes: listThemes(),
  }));

  ipcMain.handle('theme:set', (_event, name: string) => {
    if (typeof name !== 'string' || name === '') {
      return themeName();
    }
    writeSettingsEdits([{ path: ['theme'], value: name }]);
    return themeName();
  });

  ipcMain.handle('themes:open-folder', () => {
    ensureUserThemesDir();
    return shell.openPath(userThemesDir());
  });
}

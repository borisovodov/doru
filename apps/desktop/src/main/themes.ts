import { BrowserWindow, app, nativeTheme } from 'electron';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readConfig } from './config';

export const TITLE_BAR_HEIGHT = 38;

export const DEFAULT_DARK_THEME = 'doru-dark';
export const DEFAULT_LIGHT_THEME = 'doru-light';

interface ThemeDefinition {
  name?: string;
  type?: string;
  colors?: Record<string, string>;
}

export interface ThemeInfo {
  name: string;
  type: 'dark' | 'light';
}

export function themesDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'themes')
    : resolve(app.getAppPath(), '..', '..', 'themes');
}

export function themeDefinition(name: string): ThemeDefinition {
  try {
    return JSON.parse(readFileSync(join(themesDir(), name, 'theme.json'), 'utf8')) as ThemeDefinition;
  } catch {
    return {};
  }
}

export function listBuiltinThemes(): ThemeInfo[] {
  try {
    const root = themesDir();
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .map((name) => {
        try {
          const definition = themeDefinition(name);
          return {
            name: definition.name ?? name,
            type: definition.type === 'light' ? 'light' : 'dark',
          } as ThemeInfo;
        } catch {
          return null;
        }
      })
      .filter((theme): theme is ThemeInfo => theme !== null);
  } catch {
    return [];
  }
}

export function themeConfig(): { dark: string; light: string } {
  const theme = (readConfig().theme ?? {}) as { dark?: string; light?: string };
  return { dark: theme.dark ?? DEFAULT_DARK_THEME, light: theme.light ?? DEFAULT_LIGHT_THEME };
}

export function themeCss(name: string): string {
  const colors = themeDefinition(name).colors ?? {};
  const lines = Object.entries(colors).map(([key, value]) => `  --doru-${key}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}\n`;
}

export function titleBarOverlayOptions(): { color: string; symbolColor: string; height: number } {
  const dark = nativeTheme.shouldUseDarkColors;
  const themeName = dark ? themeConfig().dark : themeConfig().light;
  const definition = themeDefinition(themeName);
  const color = definition.colors?.['bg-chrome'] ?? (dark ? '#161a17' : '#f2efe7');
  return {
    color,
    symbolColor: definition.type === 'light' ? '#000000' : '#ffffff',
    height: TITLE_BAR_HEIGHT,
  };
}

export function updateTitleBarOverlays(): void {
  if (process.platform === 'darwin') {
    return;
  }
  const overlay = titleBarOverlayOptions();
  for (const window of BrowserWindow.getAllWindows()) {
    window.setTitleBarOverlay(overlay);
  }
}

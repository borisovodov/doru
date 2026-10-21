import { BrowserWindow, app, nativeTheme } from 'electron';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { readSettings } from './settings';
import { log } from './log';
import { ThemeFileSchema } from './schemas';

export const TITLE_BAR_HEIGHT = 38;

export const DEFAULT_THEME = 'doru';

interface ThemeDefinition {
  name?: string;
  dark?: Record<string, string>;
  light?: Record<string, string>;
}

export interface ThemeInfo {
  /** The file name without the extension; also the id used in `settings.json`. */
  id: string;
  /** The display name (`name` field inside the file, or the id). */
  name: string;
}

/** Bundled themes shipped in the app resources (or the repo `themes/` in
 *  development). Read-only for users of a packaged build. */
export function builtinThemesDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'themes')
    : resolve(app.getAppPath(), '..', '..', 'themes');
}

/** User themes: `<userData>/themes`, the place where users drop their own
 *  theme files. Created on startup. */
export function userThemesDir(): string {
  return join(app.getPath('userData'), 'themes');
}

export function ensureUserThemesDir(): void {
  mkdirSync(userThemesDir(), { recursive: true });
}

/** Reads one theme file, or null when the file is missing, malformed or does
 *  not match the theme schema (an invalid user theme is skipped like a
 *  broken one; a warning is logged). */
function readTheme(dir: string, name: string): ThemeDefinition | null {
  try {
    const parsed = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8')) as unknown;
    const result = ThemeFileSchema.safeParse(parsed);
    if (!result.success) {
      log.warn(`theme "${name}" does not match the theme schema:\n${z.prettifyError(result.error)}`);
      return null;
    }
    return result.data as ThemeDefinition;
  } catch {
    return null;
  }
}

/** The theme definition: a user theme with the same id overrides the
 *  bundled one; an unknown id falls back to an empty palette. */
export function themeDefinition(name: string): ThemeDefinition {
  return readTheme(userThemesDir(), name) ?? readTheme(builtinThemesDir(), name) ?? {};
}

function themesIn(dir: string): ThemeInfo[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name.slice(0, -'.json'.length))
      .map((id) => {
        // Malformed files and files that fail schema validation are skipped —
        // they must not appear in the theme list (and cannot be selected).
        const definition = readTheme(dir, id);
        return definition ? ({ id, name: definition.name ?? id } as ThemeInfo) : null;
      })
      .filter((theme): theme is ThemeInfo => theme !== null);
  } catch {
    return [];
  }
}

/** All available themes: bundled ones plus user themes from
 *  `userData/themes`; a user theme with a bundled id wins. */
export function listThemes(): ThemeInfo[] {
  const themes = new Map<string, ThemeInfo>();
  for (const theme of themesIn(builtinThemesDir())) {
    themes.set(theme.id, theme);
  }
  for (const theme of themesIn(userThemesDir())) {
    themes.set(theme.id, theme);
  }
  return [...themes.values()];
}

/** The active theme id from `settings.json` (`"theme": "doru"`). */
export function themeName(): string {
  const theme = readSettings()['theme'];
  return typeof theme === 'string' && theme !== '' ? theme : DEFAULT_THEME;
}

/** The palette that applies right now. The operating system appearance is
 *  the only authority for dark vs light; there is no override. */
export function activeMode(): 'dark' | 'light' {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

export function themeCss(name: string, mode: 'dark' | 'light'): string {
  const definition = themeDefinition(name);
  const colors = mode === 'dark' ? definition.dark : definition.light;
  const lines = Object.entries(colors ?? {}).map(([key, value]) => `  --doru-${key}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}\n`;
}

export function titleBarOverlayOptions(): { color: string; symbolColor: string; height: number } {
  const mode = activeMode();
  const color = chromeColor(themeDefinition(themeName()), mode);
  return {
    color,
    symbolColor: symbolColor(color, mode),
    height: TITLE_BAR_HEIGHT,
  };
}

/**
 * The shell (chrome) color of the active palette. The hardcoded fallback
 * mirrors the baseline palette in `workbench.css` `:root` and only applies
 * when a theme does not define `bg-chrome`; the built-in theme does.
 */
function chromeColor(definition: ThemeDefinition, mode: 'dark' | 'light'): string {
  const colors = mode === 'dark' ? definition.dark : definition.light;
  return colors?.['bg-chrome'] ?? (mode === 'dark' ? '#161a17' : '#f2efe7');
}

/** Black or white window-control symbols, chosen by the luminance of the
 *  actual chrome color so they stay readable whatever palette is active. */
function symbolColor(color: string, mode: 'dark' | 'light'): string {
  const match = /^#([0-9a-f]{6})/i.exec(color.trim());
  if (!match) {
    return mode === 'light' ? '#000000' : '#ffffff';
  }
  const hex = match[1];
  if (!hex) {
    return mode === 'light' ? '#000000' : '#ffffff';
  }
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? '#000000' : '#ffffff';
}

/** The native window surface color, kept in sync with the theme so live
 *  resizes never flash the default white background. */
export function windowBackgroundColor(): string {
  const mode = activeMode();
  return chromeColor(themeDefinition(themeName()), mode);
}

export function updateWindowBackgrounds(): void {
  const background = windowBackgroundColor();
  for (const window of BrowserWindow.getAllWindows()) {
    window.setBackgroundColor(background);
  }
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

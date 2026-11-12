import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import type { ThemeDefinition, ThemePalette } from '../src/storybook/themes';

const VIRTUAL_ID = 'virtual:doru-themes';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const HERE = dirname(fileURLToPath(import.meta.url));

interface ThemeFile {
  name?: unknown;
  dark?: unknown;
  light?: unknown;
}

function isPalette(value: unknown): value is ThemePalette {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === 'string');
}

function readThemes(dir: string): ThemeDefinition[] {
  let entries: string[];
  try {
    entries = readdirSync(dir).filter((entry) => entry.endsWith('.json'));
  } catch {
    return [];
  }
  const themes: ThemeDefinition[] = [];
  for (const entry of entries) {
    try {
      const parsed = JSON.parse(readFileSync(join(dir, entry), 'utf8')) as ThemeFile;
      if (!isPalette(parsed.dark) && !isPalette(parsed.light)) {
        continue;
      }
      const id = entry.slice(0, -'.json'.length);
      themes.push({
        id,
        name: typeof parsed.name === 'string' && parsed.name !== '' ? parsed.name : id,
        dark: isPalette(parsed.dark) ? parsed.dark : {},
        light: isPalette(parsed.light) ? parsed.light : {},
      });
    } catch {
      // Malformed files are skipped, matching the app's theme loader.
    }
  }
  return themes.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Serves the bundled themes plus the user's themes from
 * `<DORU_USER_DATA>/themes` as a virtual module for the Storybook toolbar.
 */
export function themePlugin(): Plugin {
  const repoRoot = resolve(HERE, '../../..');
  const builtinDir = join(repoRoot, 'themes');
  const userThemeDir =
    typeof process.env['DORU_USER_DATA'] === 'string' && process.env['DORU_USER_DATA'] !== ''
      ? join(process.env['DORU_USER_DATA'], 'themes')
      : null;

  return {
    name: 'doru-storybook-themes',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) {
        return null;
      }
      const themes = new Map<string, ThemeDefinition>();
      for (const theme of readThemes(builtinDir)) {
        themes.set(theme.id, theme);
      }
      if (userThemeDir !== null) {
        for (const theme of readThemes(userThemeDir)) {
          themes.set(theme.id, theme);
        }
      }
      return `export default ${JSON.stringify([...themes.values()])};`;
    },
    configureServer(server) {
      const dirs = [builtinDir, ...(userThemeDir !== null ? [userThemeDir] : [])];
      server.watcher.add(dirs);
      server.watcher.on('all', (_event, path) => {
        if (path.endsWith('.json')) {
          const module = server.moduleGraph.getModuleById(RESOLVED_ID);
          if (module) {
            void server.reloadModule(module);
          }
        }
      });
    },
  };
}

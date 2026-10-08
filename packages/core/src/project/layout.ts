export const TREE_FILE_NAME = 'tree.doru';

export const SETTINGS_FILE_NAME = 'settings.json';

export const THEME_FILE_NAME = 'theme.css';

export const HISTORY_FILE_NAME = 'history.jsonl';

export const PROJECT_DIRS = ['media', 'export'] as const;

export const DEFAULT_SETTINGS = `{
  // Locale: "auto" picks the OS language, otherwise use "en", "ru", ...
  "locale": "auto"
}
`;

export const DEFAULT_THEME_CSS = `/* Dóru theme. Customize CSS custom properties to restyle the app. */
`;

export interface ProjectLayout {
  folder: string;
  treeFile: string;
  settingsFile: string;
  themeFile: string;
  historyFile: string;
  dirs: readonly string[];
}

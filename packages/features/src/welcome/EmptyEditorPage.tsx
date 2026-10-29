import { useMemo } from 'react';
import { nls } from '../nls';
import './EmptyEditorPage.css';

export interface EmptyEditorPageProps {
  platform?: string;
}

/** How many shortcuts the empty page shows per visit. */
const SHOWN_SHORTCUTS = 5;

/** A uniform random integer in [0, limit). */
function randomIndex(limit: number): number {
  return Math.floor(Math.random() * limit);
}

/**
 * Picks `count` entries from `items` in random order without repeats
 * (Fisher–Yates, stopped early).
 */
function sample<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    const index = randomIndex(pool.length);
    const [entry] = pool.splice(index, 1);
    if (entry !== undefined) {
      picked.push(entry);
    }
  }
  return picked;
}

/**
 * The editor area's empty state for a window with a project open and no
 * tabs: the wordmark in the site's display face plus a rotating sample of
 * the keyboard shortcuts the app registers.
 */
export function EmptyEditorPage({ platform }: EmptyEditorPageProps) {
  const isMac = platform === 'darwin';
  const modKey = isMac ? '⌘' : 'Ctrl';
  const shiftKey = isMac ? '⇧' : 'Shift';
  const altKey = isMac ? '⌥' : 'Alt';

  const allShortcuts = useMemo(
    () => [
      { label: nls.t('workbench.createProject'), keys: [modKey, 'N'] },
      { label: nls.t('workbench.openProject'), keys: [modKey, 'O'] },
      { label: nls.t('workbench.saveProject'), keys: [modKey, 'S'] },
      { label: nls.t('workbench.exportGedcom'), keys: [modKey, shiftKey, 'E'] },
      { label: nls.t('workbench.undo'), keys: [modKey, 'Z'] },
      { label: nls.t('workbench.redo'), keys: [modKey, shiftKey, 'Z'] },
      { label: nls.t('workbench.closeActiveTab'), keys: [modKey, 'W'] },
      {
        label: nls.t('workbench.nextTab'),
        keys: isMac ? [modKey, shiftKey, ']'] : ['Ctrl', 'Tab'],
      },
      {
        label: nls.t('workbench.prevTab'),
        keys: isMac ? [modKey, shiftKey, '['] : ['Ctrl', shiftKey, 'Tab'],
      },
      { label: nls.t('workbench.settings'), keys: [modKey, ','] },
      { label: nls.t('workbench.toggleAgentChat'), keys: [modKey, altKey, 'B'] },
    ],
    [isMac, modKey, shiftKey, altKey],
  );

  // Resampled once per mount, so every visit to the empty page shows a
  // fresh, short list instead of a wall that needs scrolling.
  const shortcuts = useMemo(() => sample(allShortcuts, SHOWN_SHORTCUTS), [allShortcuts]);

  return (
    <div className="empty-editor-page">
      <h1 className="empty-editor-name">{nls.t('app.name')}</h1>
      <h2 className="empty-editor-shortcuts-title">{nls.t('workbench.keyboardShortcuts')}</h2>
      <ul className="empty-editor-shortcuts">
        {shortcuts.map((shortcut) => (
          <li key={shortcut.label}>
            <span className="empty-editor-shortcut-label">{shortcut.label}</span>
            <span className="empty-editor-keys">
              {shortcut.keys.map((key, index) => (
                <kbd key={`${key}-${index}`}>{key}</kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

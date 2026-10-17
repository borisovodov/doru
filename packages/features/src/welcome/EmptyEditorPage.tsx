import '@fontsource/berkshire-swash';
import { nls } from '../nls';
import './EmptyEditorPage.css';

export interface EmptyEditorPageProps {
  platform?: string;
}

/**
 * The editor area's empty state for a window with a project open and no
 * tabs: the wordmark in the site's display face plus the keyboard
 * shortcuts the app registers.
 */
export function EmptyEditorPage({ platform }: EmptyEditorPageProps) {
  const isMac = platform === 'darwin';
  const modKey = isMac ? '⌘' : 'Ctrl';
  const shiftKey = isMac ? '⇧' : 'Shift';
  const altKey = isMac ? '⌥' : 'Alt';

  const shortcuts = [
    { label: nls.t('workbench.undo'), keys: [modKey, 'Z'] },
    { label: nls.t('workbench.redo'), keys: [modKey, shiftKey, 'Z'] },
    { label: nls.t('workbench.closeActiveTab'), keys: [modKey, 'W'] },
    { label: nls.t('workbench.toggleSecondarySideBar'), keys: [modKey, altKey, 'B'] },
  ];

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

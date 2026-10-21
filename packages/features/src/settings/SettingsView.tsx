import { nls } from '../nls';
import './SettingsView.css';

export interface ThemeEntry {
  id: string;
  name: string;
}

export interface SettingsViewProps {
  /** The active theme id. */
  theme: string;
  /** All available themes (bundled plus user themes). */
  themes: ThemeEntry[];
  onThemeChange: (id: string) => void;
  onOpenLogs: () => void;
  onOpenThemesFolder: () => void;
  /** The app version shown in the About section. */
  version: string;
}

export function SettingsView({
  theme,
  themes,
  onThemeChange,
  onOpenLogs,
  onOpenThemesFolder,
  version,
}: SettingsViewProps) {
  return (
    <div className="settings-view">
      <div className="settings-section">
        <h3>{nls.t('settings.theme.title')}</h3>
        <select
          value={theme}
          onChange={(event) => onThemeChange(event.target.value)}
          aria-label={nls.t('settings.theme.title')}
        >
          {themes.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
        <button className="settings-link" onClick={onOpenThemesFolder}>
          {nls.t('settings.theme.openThemesFolder')}
        </button>
      </div>
      <div className="settings-section">
        <h3>{nls.t('settings.diagnostics.title')}</h3>
        <button className="settings-link" onClick={onOpenLogs}>
          {nls.t('settings.diagnostics.openLog')}
        </button>
      </div>
      <div className="settings-section">
        <h3>{nls.t('settings.about.title')}</h3>
        <p className="settings-note">{nls.t('settings.about.version', version)}</p>
      </div>
    </div>
  );
}

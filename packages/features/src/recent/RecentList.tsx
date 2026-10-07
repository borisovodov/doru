import type { RecentProject } from '@doru/core';
import { LocalizationService } from '@doru/platform';

const detected =
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ru')
    ? 'ru'
    : 'en';

const nls = new LocalizationService(detected);

export interface RecentListProps {
  projects: RecentProject[];
  onOpen: (path: string) => void;
  onBrowse: () => void;
}

export function RecentList({ projects, onOpen, onBrowse }: RecentListProps) {
  return (
    <div className="recent-list">
      <button onClick={onBrowse}>{nls.t('workbench.openProject')}</button>
      <h3>{nls.t('workbench.recent')}</h3>
      {projects.length === 0 ? (
        <p>{nls.t('workbench.recent.empty')}</p>
      ) : (
        <ul>
          {projects.map((project) => (
            <li key={project.path}>
              <button className="recent-item" title={project.path} onClick={() => onOpen(project.path)}>
                {basename(project.path)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

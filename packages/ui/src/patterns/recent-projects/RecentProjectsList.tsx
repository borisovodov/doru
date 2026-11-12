import { X } from 'lucide-react';
import type { RecentProject } from '@doru/core';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { nls } from '../../nls';
import styles from './RecentProjectsList.module.css';

export interface RecentProjectsListProps {
  recent: RecentProject[];
  onOpen: (path: string) => void;
  onRemove: (path: string) => void;
}

/** The recent-project rows of the welcome screen: name, path and remove. */
export function RecentProjectsList({ recent, onOpen, onRemove }: RecentProjectsListProps) {
  if (recent.length === 0) {
    return <p className={styles['empty']}>{nls.t('workbench.recent.empty')}</p>;
  }
  return (
    <ul className={styles['list']}>
      {recent.map((project) => (
        <li key={project.path}>
          <button
            type="button"
            className={styles['item']}
            title={project.path}
            onClick={() => onOpen(project.path)}
          >
            <span className={styles['name']}>{projectName(project.path)}</span>
            <span className={styles['path']}>{project.path}</span>
          </button>
          <IconButton
            className={styles['remove']}
            size="sm"
            label={nls.t('workbench.recent.remove')}
            icon={<X size={14} aria-hidden="true" />}
            onClick={() => onRemove(project.path)}
          />
        </li>
      ))}
    </ul>
  );
}

function projectName(path: string): string {
  const base = basename(path);
  return base.toLowerCase().endsWith('.doru') ? base.slice(0, -5) : base;
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

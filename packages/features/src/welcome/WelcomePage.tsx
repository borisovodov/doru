import { X } from 'lucide-react';
import type { RecentProject } from '@doru/core';
import { nls } from '../nls';
import './WelcomePage.css';

export interface WelcomePageProps {
  recent: RecentProject[];
  onCreateProject: () => void;
  onOpenProject: () => void;
  onOpenRecent: (path: string) => void;
  onRemoveRecent: (path: string) => void;
}

export function WelcomePage({
  recent,
  onCreateProject,
  onOpenProject,
  onOpenRecent,
  onRemoveRecent,
}: WelcomePageProps) {
  return (
    <div className="welcome-page">
      <div className="welcome-hero">
        <h1 className="welcome-name">{nls.t('app.name')}</h1>
        <div className="welcome-actions">
          <button className="welcome-primary" onClick={onCreateProject}>
            {nls.t('workbench.welcome.createProject')}
          </button>
          <button className="welcome-secondary" onClick={onOpenProject}>
            {nls.t('workbench.openProject')}
          </button>
        </div>
      </div>
      <section className="welcome-recent">
        <h2>{nls.t('workbench.recent')}</h2>
        {recent.length === 0 ? (
          <p className="welcome-recent-empty">{nls.t('workbench.recent.empty')}</p>
        ) : (
          <ul>
            {recent.map((project) => (
              <li key={project.path}>
                <button
                  className="welcome-recent-item"
                  title={project.path}
                  onClick={() => onOpenRecent(project.path)}
                >
                  <span className="welcome-recent-name">{projectName(project.path)}</span>
                  <span className="welcome-recent-path">{project.path}</span>
                </button>
                <button
                  type="button"
                  className="welcome-recent-remove"
                  aria-label={nls.t('workbench.recent.remove')}
                  onClick={() => onRemoveRecent(project.path)}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
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

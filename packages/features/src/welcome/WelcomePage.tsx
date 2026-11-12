import type { RecentProject } from '@doru/core';
import { Button, RecentProjectsList } from '@doru/ui';
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
    <section className="welcome-page" aria-label={nls.t('workbench.welcome.title')}>
      <div className="welcome-hero">
        <h1 className="welcome-name">{nls.t('app.name')}</h1>
        <div className="welcome-actions">
          <Button variant="primary" size="lg" onClick={onCreateProject}>
            {nls.t('workbench.welcome.createProject')}
          </Button>
          <Button variant="secondary" size="lg" onClick={onOpenProject}>
            {nls.t('workbench.openProject')}
          </Button>
        </div>
      </div>
      <section className="welcome-recent">
        <h2>{nls.t('workbench.recent')}</h2>
        <RecentProjectsList recent={recent} onOpen={onOpenRecent} onRemove={onRemoveRecent} />
      </section>
    </section>
  );
}


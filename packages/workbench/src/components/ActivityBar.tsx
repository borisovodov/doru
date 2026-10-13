import type { ReactNode } from 'react';
import { nls } from '../nls';

export type ActivityViewId =
  | 'tree'
  | 'people'
  | 'places'
  | 'sources'
  | 'tasks'
  | 'search'
  | 'import'
  | 'export';

export interface ActivityBarProps {
  activeView: ActivityViewId;
  onSelectView: (view: ActivityViewId) => void;
  onOpenSettings: () => void;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true">
      {children}
    </svg>
  );
}

export function ActivityBar({ activeView, onSelectView, onOpenSettings }: ActivityBarProps) {
  const views: Array<{ id: ActivityViewId; title: string; icon: ReactNode }> = [
    {
      id: 'tree',
      title: nls.t('workbench.activityBar.tree'),
      icon: (
        <Icon>
          <circle cx="5" cy="4" r="1.5" fill="currentColor" />
          <circle cx="11" cy="4" r="1.5" fill="currentColor" />
          <circle cx="8" cy="12" r="1.5" fill="currentColor" />
          <path d="M5 5.5V7h6V5.5M8 7v3.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </Icon>
      ),
    },
    {
      id: 'people',
      title: nls.t('workbench.activityBar.people'),
      icon: (
        <Icon>
          <path
            fill="currentColor"
            d="M8 3.25a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM2.75 14.5c0-2.9 2.35-5 5.25-5s5.25 2.1 5.25 5v.5h-10.5v-.5z"
          />
        </Icon>
      ),
    },
    {
      id: 'places',
      title: nls.t('workbench.activityBar.places'),
      icon: (
        <Icon>
          <path
            fill="currentColor"
            d="M8 1a5 5 0 0 0-5 5c0 4 5 9 5 9s5-5 5-9a5 5 0 0 0-5-5zm0 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"
          />
        </Icon>
      ),
    },
    {
      id: 'sources',
      title: nls.t('workbench.activityBar.sources'),
      icon: (
        <Icon>
          <path
            fill="currentColor"
            d="M2 2.5C2 1.67 2.67 1 3.5 1H6.25v13H3.5A1.5 1.5 0 0 1 2 12.5v-10zM7.25 1H9.75v13H7.25V1zM10.75 1h1.75c.83 0 1.5.67 1.5 1.5v10c0 .83-.67 1.5-1.5 1.5h-1.75V1z"
          />
        </Icon>
      ),
    },
    {
      id: 'tasks',
      title: nls.t('workbench.activityBar.tasks'),
      icon: (
        <Icon>
          <path
            fill="currentColor"
            d="M1.75 3h2.5v2h-2.5V3zm4.5 0h8v1.25h-8V3zM1.75 7h2.5v2h-2.5V7zm4.5 0h8v1.25h-8V7zM1.75 11h2.5v2h-2.5v-2zm4.5 0h8v1.25h-8V11z"
          />
        </Icon>
      ),
    },
    {
      id: 'search',
      title: nls.t('workbench.activityBar.search'),
      icon: (
        <Icon>
          <circle cx="6.5" cy="6.5" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="9.7" y1="9.7" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </Icon>
      ),
    },
    {
      id: 'import',
      title: nls.t('workbench.activityBar.import'),
      icon: (
        <Icon>
          <path fill="currentColor" d="M8 9.5L11.5 6h-1.7V2H6.2v4H4.5L8 9.5zM2 12h12v2H2v-2z" />
        </Icon>
      ),
    },
    {
      id: 'export',
      title: nls.t('workbench.activityBar.export'),
      icon: (
        <Icon>
          <path fill="currentColor" d="M8 6.5L4.5 10h1.7v4h3.6v-4h1.7L8 6.5zM2 12h12v2H2v-2z" />
        </Icon>
      ),
    },
  ];

  return (
    <div className="activity-bar">
      {views.map((view) => (
        <button
          key={view.id}
          className={view.id === activeView ? 'activity-bar-item active' : 'activity-bar-item'}
          title={view.title}
          onClick={() => onSelectView(view.id)}
        >
          {view.icon}
        </button>
      ))}
      <button
        className="activity-bar-item activity-bar-bottom"
        title={nls.t('workbench.activityBar.settings')}
        onClick={onOpenSettings}
      >
        <Icon>
          <path
            fill="currentColor"
            d="M9.1 4.4L8.6 2H7.4l-.5 2.4a4.99 4.99 0 0 0-1.6.9L3.1 4.1 2.2 5l2.2 2.2a5 5 0 0 0-.4 1.6H1.6v1.2H4a5 5 0 0 0 .4 1.6l-2.2 2.2.9.9 2.2-2.2a5 5 0 0 0 1.6.9L7.4 16h1.2l.5-2.4a5 5 0 0 0 1.6-.9l2.2 2.2.9-.9-2.2-2.2a5 5 0 0 0 .4-1.6h2.4V8.8H12a5 5 0 0 0-.4-1.6l2.2-2.2-.9-.9-2.2 2.2a5 5 0 0 0-1.6-.9z"
          />
        </Icon>
      </button>
    </div>
  );
}

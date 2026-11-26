import type { ReactNode } from 'react';
import { Blend, BookOpenText, Image, ListTodo, Map, Search, Settings, TreeDeciduous, User } from 'lucide-react';
import { SEARCH_VISIBLE } from '@doru/platform';
import { IconButton } from '@doru/ui';
import { nls } from '../nls';

export type ActivityViewId = 'tree' | 'search' | 'people' | 'families' | 'places' | 'media' | 'sources' | 'tasks';

export interface ActivityBarProps {
  activeView: ActivityViewId;
  onSelectView: (view: ActivityViewId) => void;
  onOpenSettings: () => void;
  /** Display labels of registered view shortcuts, e.g. `{ search: '⌘⇧F' }`. */
  shortcuts?: Partial<Record<ActivityViewId, string>> | undefined;
}

const ICON_SIZE = 24;

export function ActivityBar({ activeView, onSelectView, onOpenSettings, shortcuts }: ActivityBarProps) {
  const views: Array<{ id: ActivityViewId; title: string; icon: ReactNode }> = [
    {
      id: 'tree',
      title: nls.t('workbench.activityBar.tree'),
      icon: <TreeDeciduous size={ICON_SIZE} aria-hidden="true" />,
    },
    ...(SEARCH_VISIBLE
      ? [
          {
            id: 'search' as const,
            title: nls.t('workbench.activityBar.search'),
            icon: <Search size={ICON_SIZE} aria-hidden="true" />,
          },
        ]
      : []),
    {
      id: 'people',
      title: nls.t('workbench.activityBar.people'),
      icon: <User size={ICON_SIZE} aria-hidden="true" />,
    },
    {
      id: 'families',
      title: nls.t('workbench.activityBar.families'),
      icon: <Blend size={ICON_SIZE} aria-hidden="true" />,
    },
    {
      id: 'places',
      title: nls.t('workbench.activityBar.places'),
      icon: <Map size={ICON_SIZE} aria-hidden="true" />,
    },
    {
      id: 'tasks',
      title: nls.t('workbench.activityBar.tasks'),
      icon: <ListTodo size={ICON_SIZE} aria-hidden="true" />,
    },
    {
      id: 'sources',
      title: nls.t('workbench.activityBar.sources'),
      icon: <BookOpenText size={ICON_SIZE} aria-hidden="true" />,
    },
    {
      id: 'media',
      title: nls.t('workbench.activityBar.media'),
      icon: <Image size={ICON_SIZE} aria-hidden="true" />,
    },
  ];

  return (
    <nav className="activity-bar" aria-label={nls.t('workbench.activityBar.label')}>
      {views.map((view) => (
        <IconButton
          key={view.id}
          size="nav"
          variant={view.id === activeView ? 'active' : 'ghost'}
          label={view.title}
          icon={view.icon}
          aria-current={view.id === activeView ? 'page' : undefined}
          shortcut={shortcuts?.[view.id]}
          tooltipPlacement="right"
          onClick={() => onSelectView(view.id)}
        />
      ))}
      <IconButton
        className="activity-bar-bottom"
        size="nav"
        label={nls.t('workbench.activityBar.settings')}
        icon={<Settings size={ICON_SIZE} aria-hidden="true" />}
        tooltipPlacement="right"
        onClick={onOpenSettings}
      />
    </nav>
  );
}

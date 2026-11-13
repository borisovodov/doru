import { useEffect, useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react';
import {
  Blend,
  BookOpenText,
  CalendarDays,
  Image,
  ListTodo,
  Map,
  Search,
  Settings,
  TreeDeciduous,
  User,
} from 'lucide-react';
import { IconButton } from '@doru/ui';
import { nls } from '../nls';

export type ActivityViewId =
  | 'tree'
  | 'search'
  | 'people'
  | 'families'
  | 'events'
  | 'places'
  | 'media'
  | 'sources'
  | 'tasks';

export interface ActivityBarProps {
  activeView: ActivityViewId;
  onSelectView: (view: ActivityViewId) => void;
  onOpenSettings: () => void;
}

/** Native title tooltips are unreliable under the custom drag region on
 *  macOS, so the activity bar draws its own. */
const TOOLTIP_DELAY_MS = 600;

const ICON_SIZE = 24;

export function ActivityBar({ activeView, onSelectView, onOpenSettings }: ActivityBarProps) {
  const [tooltip, setTooltip] = useState<{ label: string; top: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const showTooltip = (label: string, element: HTMLElement) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      const rect = element.getBoundingClientRect();
      setTooltip({ label, top: rect.top + rect.height / 2 });
    }, TOOLTIP_DELAY_MS);
  };

  const hideTooltip = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTooltip(null);
  };

  /* eslint-disable react-hooks/refs -- these handlers read the timer ref only from DOM events, never during render */
  const tooltipHandlers = (label: string) => ({
    onMouseEnter: (event: MouseEvent<HTMLButtonElement>) => showTooltip(label, event.currentTarget),
    onMouseLeave: hideTooltip,
    onFocus: (event: FocusEvent<HTMLButtonElement>) => showTooltip(label, event.currentTarget),
    onBlur: hideTooltip,
  });
  /* eslint-enable react-hooks/refs */

  const views: Array<{ id: ActivityViewId; title: string; icon: ReactNode }> = [
    {
      id: 'tree',
      title: nls.t('workbench.activityBar.tree'),
      icon: <TreeDeciduous size={ICON_SIZE} aria-hidden="true" />,
    },
    {
      id: 'search',
      title: nls.t('workbench.activityBar.search'),
      icon: <Search size={ICON_SIZE} aria-hidden="true" />,
    },
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
      id: 'events',
      title: nls.t('workbench.activityBar.events'),
      icon: <CalendarDays size={ICON_SIZE} aria-hidden="true" />,
    },
    {
      id: 'places',
      title: nls.t('workbench.activityBar.places'),
      icon: <Map size={ICON_SIZE} aria-hidden="true" />,
    },
    {
      id: 'media',
      title: nls.t('workbench.activityBar.media'),
      icon: <Image size={ICON_SIZE} aria-hidden="true" />,
    },
    {
      id: 'sources',
      title: nls.t('workbench.activityBar.sources'),
      icon: <BookOpenText size={ICON_SIZE} aria-hidden="true" />,
    },
    {
      id: 'tasks',
      title: nls.t('workbench.activityBar.tasks'),
      icon: <ListTodo size={ICON_SIZE} aria-hidden="true" />,
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
          onClick={() => onSelectView(view.id)}
          {...tooltipHandlers(view.title)}
        />
      ))}
      <IconButton
        className="activity-bar-bottom"
        size="nav"
        label={nls.t('workbench.activityBar.settings')}
        icon={<Settings size={ICON_SIZE} aria-hidden="true" />}
        onClick={onOpenSettings}
        {...tooltipHandlers(nls.t('workbench.activityBar.settings'))}
      />
      {tooltip && (
        <div className="activity-tooltip" style={{ top: tooltip.top }} role="tooltip">
          {tooltip.label}
        </div>
      )}
    </nav>
  );
}

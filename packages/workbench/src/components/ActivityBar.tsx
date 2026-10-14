import { useEffect, useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react';
import {
  BookOpenText,
  FileDown,
  Globe,
  ListTodo,
  Search,
  Settings,
  Share,
  TreeDeciduous,
  UserRoundGroup,
} from 'lucide-react';
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

  const tooltipHandlers = (label: string) => ({
    onMouseEnter: (event: MouseEvent<HTMLButtonElement>) => showTooltip(label, event.currentTarget),
    onMouseLeave: hideTooltip,
    onFocus: (event: FocusEvent<HTMLButtonElement>) => showTooltip(label, event.currentTarget),
    onBlur: hideTooltip,
  });

  const views: Array<{ id: ActivityViewId; title: string; icon: ReactNode }> = [
    {
      id: 'tree',
      title: nls.t('workbench.activityBar.tree'),
      icon: <TreeDeciduous size={ICON_SIZE} aria-hidden="true" />,
    },
    {
      id: 'people',
      title: nls.t('workbench.activityBar.people'),
      icon: <UserRoundGroup size={ICON_SIZE} aria-hidden="true" />,
    },
    {
      id: 'places',
      title: nls.t('workbench.activityBar.places'),
      icon: <Globe size={ICON_SIZE} aria-hidden="true" />,
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
    {
      id: 'search',
      title: nls.t('workbench.activityBar.search'),
      icon: <Search size={ICON_SIZE} aria-hidden="true" />,
    },
    {
      id: 'import',
      title: nls.t('workbench.activityBar.import'),
      icon: <FileDown size={ICON_SIZE} aria-hidden="true" />,
    },
    {
      id: 'export',
      title: nls.t('workbench.activityBar.export'),
      icon: <Share size={ICON_SIZE} aria-hidden="true" />,
    },
  ];

  return (
    <div className="activity-bar">
      {views.map((view) => (
        <button
          key={view.id}
          className={view.id === activeView ? 'activity-bar-item active' : 'activity-bar-item'}
          aria-label={view.title}
          onClick={() => onSelectView(view.id)}
          {...tooltipHandlers(view.title)}
        >
          {view.icon}
        </button>
      ))}
      <button
        className="activity-bar-item activity-bar-bottom"
        aria-label={nls.t('workbench.activityBar.settings')}
        onClick={onOpenSettings}
        {...tooltipHandlers(nls.t('workbench.activityBar.settings'))}
      >
        <Settings size={ICON_SIZE} aria-hidden="true" />
      </button>
      {tooltip && (
        <div className="activity-tooltip" style={{ top: tooltip.top }} role="tooltip">
          {tooltip.label}
        </div>
      )}
    </div>
  );
}

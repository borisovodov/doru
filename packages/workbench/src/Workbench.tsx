import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CommandService, KeybindingService } from '@doru/platform';
import { nls } from './nls';
import { ActivityBar, type ActivityViewId } from './components/ActivityBar';
import { EditorArea } from './components/EditorArea';
import { Sash } from './components/Sash';
import { SecondarySideBar } from './components/SecondarySideBar';
import { SideBar } from './components/SideBar';
import type { TabInfo } from './components/TabBar';
import './workbench.css';

export interface WorkbenchProps {
  commands: CommandService;
  keybindings?: Array<{ key: string; command: string }>;
  title?: string;
  platform?: string;
  sidebar?: ReactNode;
  secondarySidebar?: ReactNode;
  editor?: ReactNode;
  tabs?: TabInfo[];
  activeTabId?: string | null;
  onSelectTab?: (id: string) => void;
  onCloseTab?: (id: string) => void;
  onReorderTab?: (sourceId: string, dropIndex: number) => void;
  activeView: ActivityViewId;
  onSelectView: (view: ActivityViewId) => void;
  onOpenSettings?: () => void;
}

const DEFAULT_SIDE_BAR_WIDTH = 260;
const DEFAULT_SECONDARY_WIDTH = 320;
const MIN_SIDE_BAR_WIDTH = 160;
const MAX_SIDE_BAR_WIDTH = 520;
const MIN_SECONDARY_WIDTH = 220;
const MAX_SECONDARY_WIDTH = 560;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export function Workbench({
  commands,
  keybindings: externalKeybindings = [],
  title,
  platform,
  sidebar,
  secondarySidebar,
  editor,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onReorderTab,
  activeView,
  onSelectView,
  onOpenSettings,
}: WorkbenchProps) {
  const [secondarySideBarOpen, setSecondarySideBarOpen] = useState(true);
  const [sideBarWidth, setSideBarWidth] = useState(DEFAULT_SIDE_BAR_WIDTH);
  const [secondaryWidth, setSecondaryWidth] = useState(DEFAULT_SECONDARY_WIDTH);
  const sideBarStartRef = useRef(DEFAULT_SIDE_BAR_WIDTH);
  const secondaryStartRef = useRef(DEFAULT_SECONDARY_WIDTH);

  useEffect(() => {
    const keybindings = new KeybindingService();
    keybindings.register('meta+alt+b', 'workbench.toggleSecondarySideBar');
    keybindings.register('ctrl+alt+b', 'workbench.toggleSecondarySideBar');
    keybindings.register('meta+w', 'workbench.closeActiveTab');
    keybindings.register('ctrl+w', 'workbench.closeActiveTab');
    for (const binding of externalKeybindings) {
      keybindings.register(binding.key, binding.command);
    }
    const removeToggleSecondarySideBar = commands.register({
      id: 'workbench.toggleSecondarySideBar',
      title: nls.t('workbench.toggleSecondarySideBar'),
      handler: () => setSecondarySideBarOpen((open) => !open),
    });
    const removeCloseActiveTab = commands.register({
      id: 'workbench.closeActiveTab',
      title: nls.t('workbench.closeActiveTab'),
      handler: () => {
        if (activeTabId) {
          onCloseTab?.(activeTabId);
        }
      },
    });
    const onKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const command = keybindings.onKeydown(event);
      if (command) {
        event.preventDefault();
        void commands.execute(command);
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => {
      removeToggleSecondarySideBar.dispose();
      removeCloseActiveTab.dispose();
      window.removeEventListener('keydown', onKeydown);
    };
  }, [commands, externalKeybindings, activeTabId, onCloseTab]);

  const layoutClasses = ['workbench'];
  if (secondarySideBarOpen) {
    layoutClasses.push('secondary-open');
  }

  const layoutStyle = {
    '--doru-sidebar-width': `${sideBarWidth}px`,
    '--doru-secondary-column': `${secondaryWidth + 8}px`,
    // Sash positions: the sashes live in the 4px gutters BETWEEN the floating
    // cards (like VS Code), centered on the gap. The side cluster's right
    // border sits at 4 (gutter) + 48 (rail) + 2 (borders) + sideBarWidth, and
    // the secondary card's left border sits 4px into its column.
    '--doru-side-sash-left': `${sideBarWidth + 52}px`,
    '--doru-secondary-sash-right': `${secondaryWidth + 2}px`,
  } as CSSProperties;

  const onSideSashStart = () => {
    sideBarStartRef.current = sideBarWidth;
  };
  const onSideSashResize = (delta: number) => {
    setSideBarWidth(clamp(sideBarStartRef.current + delta, MIN_SIDE_BAR_WIDTH, MAX_SIDE_BAR_WIDTH));
  };
  const onSecondarySashStart = () => {
    secondaryStartRef.current = secondaryWidth;
  };
  const onSecondarySashResize = (delta: number) => {
    setSecondaryWidth(clamp(secondaryStartRef.current - delta, MIN_SECONDARY_WIDTH, MAX_SECONDARY_WIDTH));
  };

  return (
    <div className={layoutClasses.join(' ')} style={layoutStyle}>
      <div className={platform === 'darwin' ? 'title-bar title-bar-mac' : 'title-bar title-bar-overlay'}>
        <span className="title-bar-title">{title}</span>
        <div className="title-bar-actions">
          <button
            className={secondarySideBarOpen ? 'title-bar-action active' : 'title-bar-action'}
            title={nls.t('workbench.toggleSecondarySideBar')}
            aria-pressed={secondarySideBarOpen}
            onClick={() => setSecondarySideBarOpen((open) => !open)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <rect
                x="2.5"
                y="2.5"
                width="11"
                height="11"
                rx="1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <line x1="9.8" y1="2.5" x2="9.8" y2="13.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      </div>
      <div className="side-cluster">
        <ActivityBar
          activeView={activeView}
          onSelectView={onSelectView}
          onOpenSettings={onOpenSettings ?? (() => {})}
        />
        {activeView !== 'tree' && <SideBar>{sidebar}</SideBar>}
      </div>
      <EditorArea
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
        onReorderTab={onReorderTab}
      >
        {editor}
      </EditorArea>
      {secondarySideBarOpen && <SecondarySideBar>{secondarySidebar}</SecondarySideBar>}
      {/* The sashes live in the gutters between the floating cards, so they
          are children of the workbench, not of the cards. */}
      {activeView !== 'tree' && (
        <Sash
          className="side-sash"
          onDragStart={onSideSashStart}
          onResize={onSideSashResize}
        />
      )}
      {secondarySideBarOpen && (
        <Sash
          className="secondary-sash"
          onDragStart={onSecondarySashStart}
          onResize={onSecondarySashResize}
        />
      )}
    </div>
  );
}

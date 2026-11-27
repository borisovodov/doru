import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, PanelRight } from 'lucide-react';
import { CommandService, KeybindingService, SEARCH_VISIBLE } from '@doru/platform';
import { IconButton } from '@doru/ui';
import { nls } from './nls';
import { ActivityBar, type ActivityViewId } from './components/ActivityBar';
import { AgentChatPanel } from './components/AgentChatPanel';
import { EditorArea } from './components/EditorArea';
import { Sash } from './components/Sash';
import { SideBar } from './components/SideBar';
import type { TabInfo } from './components/TabBar';
import './workbench.css';

export interface WorkbenchProps {
  commands: CommandService;
  keybindings?: Array<{ key: string; command: string; args?: unknown[] }>;
  title?: string;
  platform?: string;
  /** Window-level Back/Forward controls shown in the title bar leading slot. */
  navigation?: TitleBarNavigation;
  /** Extra actions rendered in the title bar, before the built-in toggle. */
  titleActions?: ReactNode;
  /** Leading title bar content (e.g. the in-window menu on Windows/Linux). */
  titleMenu?: ReactNode;
  sidebar?: ReactNode;
  /** The right-hand panel content: the chat with the AI agent. */
  agentChat?: ReactNode;
  editor?: ReactNode;
  tabs?: TabInfo[] | undefined;
  activeTabId?: string | null | undefined;
  onSelectTab?: ((id: string) => void) | undefined;
  onCloseTab?: ((id: string) => void) | undefined;
  onReorderTab?: ((sourceId: string, dropIndex: number) => void) | undefined;
  activeView: ActivityViewId;
  onSelectView: (view: ActivityViewId) => void;
  onOpenSettings?: () => void;
}

export interface TitleBarNavigation {
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack(): void;
  onGoForward(): void;
}

const DEFAULT_SIDE_BAR_WIDTH = 260;
const DEFAULT_AGENT_CHAT_WIDTH = 320;
const MIN_SIDE_BAR_WIDTH = 160;
const MAX_SIDE_BAR_WIDTH = 520;
const MIN_AGENT_CHAT_WIDTH = 220;
const MAX_AGENT_CHAT_WIDTH = 560;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
const EMPTY_KEYBINDINGS: [] = [];

export function Workbench({
  commands,
  keybindings: externalKeybindings = EMPTY_KEYBINDINGS,
  title,
  titleActions,
  titleMenu,
  navigation,
  platform,
  sidebar,
  agentChat,
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
  const [agentChatOpen, setAgentChatOpen] = useState(true);
  const [sideBarWidth, setSideBarWidth] = useState(DEFAULT_SIDE_BAR_WIDTH);
  const [agentChatWidth, setAgentChatWidth] = useState(DEFAULT_AGENT_CHAT_WIDTH);
  const sideBarStartRef = useRef(DEFAULT_SIDE_BAR_WIDTH);
  const agentChatStartRef = useRef(DEFAULT_AGENT_CHAT_WIDTH);
  const isMac = platform === 'darwin';

  useEffect(() => {
    const keybindings = new KeybindingService();
    keybindings.register('meta+w', 'workbench.closeActiveTab');
    keybindings.register('ctrl+w', 'workbench.closeActiveTab');
    if (SEARCH_VISIBLE) {
      keybindings.register('meta+shift+f', 'workbench.showSearch');
      keybindings.register('ctrl+shift+f', 'workbench.showSearch');
    }
    for (const binding of externalKeybindings) {
      keybindings.register(binding.key, binding.command, binding.args);
    }
    const removeShowSearch = SEARCH_VISIBLE
      ? commands.register({
          id: 'workbench.showSearch',
          title: nls.t('workbench.activityBar.search'),
          handler: () => onSelectView('search'),
        })
      : undefined;
    const removeToggleAgentChat = commands.register({
      id: 'workbench.toggleAgentChat',
      title: nls.t('workbench.toggleAgentChat'),
      handler: () => setAgentChatOpen((open) => !open),
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
      // Plain typing in fields never triggers shortcuts, but modifier
      // combinations (meta+o and friends) stay available wherever the focus
      // is — the chat input included.
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        return;
      }
      const match = keybindings.onKeydown(event);
      if (match) {
        event.preventDefault();
        void commands.execute(match.command, ...match.args);
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => {
      removeShowSearch?.dispose();
      removeToggleAgentChat.dispose();
      removeCloseActiveTab.dispose();
      window.removeEventListener('keydown', onKeydown);
    };
  }, [commands, externalKeybindings, activeTabId, onCloseTab, onSelectView]);

  const layoutClasses = ['workbench'];
  if (agentChatOpen) {
    layoutClasses.push('agent-chat-open');
  }

  const layoutStyle = {
    '--doru-sidebar-width': `${sideBarWidth}px`,
    '--doru-agent-chat-column': `${agentChatWidth + 8}px`,
    // Sash positions: the sashes live in the 4px gutters BETWEEN the floating
    // cards, centered on the gap. The side cluster's right
    // border sits at 4 (gutter) + 48 (rail) + 2 (borders) + sideBarWidth, and
    // the agent chat card's left border sits 4px into its column.
    '--doru-side-sash-left': `${sideBarWidth + 52}px`,
    '--doru-agent-chat-sash-right': `${agentChatWidth + 2}px`,
  } as CSSProperties;

  const onSideSashStart = () => {
    sideBarStartRef.current = sideBarWidth;
  };
  const onSideSashResize = (delta: number) => {
    setSideBarWidth(clamp(sideBarStartRef.current + delta, MIN_SIDE_BAR_WIDTH, MAX_SIDE_BAR_WIDTH));
  };
  const onAgentChatSashStart = () => {
    agentChatStartRef.current = agentChatWidth;
  };
  const onAgentChatSashResize = (delta: number) => {
    setAgentChatWidth(clamp(agentChatStartRef.current - delta, MIN_AGENT_CHAT_WIDTH, MAX_AGENT_CHAT_WIDTH));
  };

  return (
    <div className={layoutClasses.join(' ')} style={layoutStyle}>
      <header className={isMac ? 'title-bar title-bar-mac' : 'title-bar title-bar-overlay'}>
        <div className="title-bar-leading">
          {titleMenu}
          {navigation !== undefined && (
            <div className="title-bar-nav">
              <IconButton
                size="md"
                label={nls.t('workbench.goBack')}
                shortcut={isMac ? '⌘[' : 'Alt+←'}
                icon={<ArrowLeft size={16} aria-hidden="true" />}
                disabled={!navigation.canGoBack}
                onClick={navigation.onGoBack}
              />
              <IconButton
                size="md"
                label={nls.t('workbench.goForward')}
                shortcut={isMac ? '⌘]' : 'Alt+→'}
                icon={<ArrowRight size={16} aria-hidden="true" />}
                disabled={!navigation.canGoForward}
                onClick={navigation.onGoForward}
              />
            </div>
          )}
        </div>
        <span className="title-bar-title">{title}</span>
        <div className="title-bar-actions">
          {titleActions}
          <IconButton
            size="md"
            variant={agentChatOpen ? 'active' : 'ghost'}
            label={nls.t('workbench.toggleAgentChat')}
            icon={<PanelRight size={16} aria-hidden="true" />}
            aria-pressed={agentChatOpen}
            onClick={() => setAgentChatOpen((open) => !open)}
          />
        </div>
      </header>
      <div className="side-cluster">
        <ActivityBar
          activeView={activeView}
          onSelectView={onSelectView}
          shortcuts={SEARCH_VISIBLE ? { search: isMac ? '⌘⇧F' : 'Ctrl+Shift+F' } : undefined}
          onOpenSettings={onOpenSettings ?? (() => {})}
        />
        {activeView !== 'tree' && <SideBar label={nls.t(sideBarLabelKey(activeView))}>{sidebar}</SideBar>}
      </div>
      <EditorArea
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
        onReorderTab={onReorderTab}
        platform={platform}
      >
        {editor}
      </EditorArea>
      {agentChatOpen && <AgentChatPanel label={nls.t('chat.title')}>{agentChat}</AgentChatPanel>}
      {/* The sashes live in the gutters between the floating cards, so they
          are children of the workbench, not of the cards. */}
      {activeView !== 'tree' && (
        <Sash
          className="side-sash"
          label={nls.t('workbench.resizeSideBar')}
          onDragStart={onSideSashStart}
          onResize={onSideSashResize}
        />
      )}
      {agentChatOpen && (
        <Sash
          className="agent-chat-sash"
          label={nls.t('workbench.resizeAgentChat')}
          onDragStart={onAgentChatSashStart}
          onResize={onAgentChatSashResize}
        />
      )}
    </div>
  );
}

function sideBarLabelKey(view: ActivityViewId): Parameters<typeof nls.t>[0] {
  switch (view) {
    case 'search':
      return 'workbench.activityBar.search';
    case 'people':
      return 'workbench.activityBar.people';
    case 'families':
      return 'workbench.activityBar.families';
    case 'places':
      return 'workbench.activityBar.places';
    case 'media':
      return 'workbench.activityBar.media';
    case 'sources':
      return 'workbench.activityBar.sources';
    case 'tasks':
      return 'workbench.activityBar.tasks';
    default:
      return 'workbench.activityBar.tree';
  }
}

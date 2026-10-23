import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { PanelRight } from 'lucide-react';
import { CommandService, KeybindingService } from '@doru/platform';
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
  /** Extra actions rendered in the title bar, before the built-in toggle. */
  titleActions?: ReactNode;
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

const DEFAULT_SIDE_BAR_WIDTH = 260;
const DEFAULT_AGENT_CHAT_WIDTH = 320;
const MIN_SIDE_BAR_WIDTH = 160;
const MAX_SIDE_BAR_WIDTH = 520;
const MIN_AGENT_CHAT_WIDTH = 220;
const MAX_AGENT_CHAT_WIDTH = 560;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export function Workbench({
  commands,
  keybindings: externalKeybindings = [],
  title,
  titleActions,
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

  useEffect(() => {
    const keybindings = new KeybindingService();
    keybindings.register('meta+w', 'workbench.closeActiveTab');
    keybindings.register('ctrl+w', 'workbench.closeActiveTab');
    for (const binding of externalKeybindings) {
      keybindings.register(binding.key, binding.command, binding.args);
    }
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
      removeToggleAgentChat.dispose();
      removeCloseActiveTab.dispose();
      window.removeEventListener('keydown', onKeydown);
    };
  }, [commands, externalKeybindings, activeTabId, onCloseTab]);

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
    setAgentChatWidth(
      clamp(agentChatStartRef.current - delta, MIN_AGENT_CHAT_WIDTH, MAX_AGENT_CHAT_WIDTH),
    );
  };

  return (
    <div className={layoutClasses.join(' ')} style={layoutStyle}>
      <div className={platform === 'darwin' ? 'title-bar title-bar-mac' : 'title-bar title-bar-overlay'}>
        <span className="title-bar-title">{title}</span>
        <div className="title-bar-actions">
          {titleActions}
          <button
            className={agentChatOpen ? 'title-bar-action active' : 'title-bar-action'}
            title={nls.t('workbench.toggleAgentChat')}
            aria-pressed={agentChatOpen}
            onClick={() => setAgentChatOpen((open) => !open)}
          >
            <PanelRight size={16} aria-hidden="true" />
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
      {agentChatOpen && <AgentChatPanel>{agentChat}</AgentChatPanel>}
      {/* The sashes live in the gutters between the floating cards, so they
          are children of the workbench, not of the cards. */}
      {activeView !== 'tree' && (
        <Sash
          className="side-sash"
          onDragStart={onSideSashStart}
          onResize={onSideSashResize}
        />
      )}
      {agentChatOpen && (
        <Sash
          className="agent-chat-sash"
          onDragStart={onAgentChatSashStart}
          onResize={onAgentChatSashResize}
        />
      )}
    </div>
  );
}

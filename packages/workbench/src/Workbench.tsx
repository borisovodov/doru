import { useEffect, useState, type ReactNode } from 'react';
import { CommandService, KeybindingService } from '@doru/platform';
import { nls } from './nls';
import { ActivityBar, type ActivityViewId } from './components/ActivityBar';
import { EditorArea } from './components/EditorArea';
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

  return (
    <div className={layoutClasses.join(' ')}>
      <div className={platform === 'darwin' ? 'title-bar title-bar-mac' : 'title-bar title-bar-overlay'}>
        <span className="title-bar-title">{title}</span>
        <div className="title-bar-actions" />
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
    </div>
  );
}

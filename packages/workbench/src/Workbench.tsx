import { useEffect, useState, type ReactNode } from 'react';
import { CommandService, KeybindingService } from '@doru/platform';
import { nls } from './nls';
import { ActivityBar } from './components/ActivityBar';
import { CommandPalette } from './components/CommandPalette';
import { EditorArea } from './components/EditorArea';
import { Panel } from './components/Panel';
import { SideBar } from './components/SideBar';
import { StatusBar } from './components/StatusBar';
import type { TabInfo } from './components/TabBar';
import './workbench.css';

export interface WorkbenchProps {
  commands: CommandService;
  sidebar?: ReactNode;
  editor?: ReactNode;
  tabs?: TabInfo[];
  activeTabId?: string | null;
  onSelectTab?: (id: string) => void;
  onCloseTab?: (id: string) => void;
  statusText?: string;
  onOpenProject: () => void;
}

export function Workbench({
  commands,
  sidebar,
  editor,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  statusText,
  onOpenProject,
}: WorkbenchProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const keybindings = new KeybindingService();
    keybindings.register('f1', 'workbench.showCommandPalette');
    const removeCommand = commands.register({
      id: 'workbench.showCommandPalette',
      title: nls.t('workbench.commandPalette.title'),
      handler: () => setPaletteOpen(true),
    });
    const onKeydown = (event: KeyboardEvent) => {
      const command = keybindings.onKeydown(event);
      if (command) {
        event.preventDefault();
        void commands.execute(command);
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => {
      removeCommand.dispose();
      window.removeEventListener('keydown', onKeydown);
    };
  }, [commands]);

  return (
    <div className="workbench">
      <ActivityBar onOpenProject={onOpenProject} />
      <SideBar>{sidebar}</SideBar>
      <div className="editor-column">
        <EditorArea tabs={tabs} activeTabId={activeTabId} onSelectTab={onSelectTab} onCloseTab={onCloseTab}>
          {editor}
        </EditorArea>
        <Panel />
      </div>
      <StatusBar text={statusText ?? nls.t('workbench.statusBar.ready')} />
      <CommandPalette commands={commands} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

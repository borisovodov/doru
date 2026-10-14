import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CommandService } from '@doru/platform';
import { ChatPanel, SettingsView, TreeView, WelcomePage } from '@doru/features';
import { Workbench, nls, type ActivityViewId } from '@doru/workbench';
import { PersonTab } from './components/PersonTab';
import { SidebarView } from './components/SidebarView';
import { useChat } from './hooks/useChat';
import { useProject } from './hooks/useProject';
import { useSettings } from './hooks/useSettings';
import {
  PERSON_TAB_PREFIX,
  SETTINGS_TAB_ID,
  TREE_TAB_ID,
  useTabs,
} from './hooks/useTabs';
import { useTheme } from './hooks/useTheme';
import { useTreeData } from './hooks/useTreeData';

export function App() {
  const [projectPath, setProjectPath] = useState<string | null | undefined>(undefined);
  const [activeView, setActiveView] = useState<ActivityViewId>('tree');

  const tree = useTreeData(projectPath);
  const chat = useChat(projectPath, tree.refreshTree);
  const tabs = useTabs(tree.persons);
  const project = useProject(projectPath, tree.refreshTree, tabs.ensureTreeTab);
  const settings = useSettings();
  const builtinThemeCss = useTheme();

  const commands = useMemo(() => new CommandService(), []);

  const startProject = useCallback(
    (path: string) => {
      setProjectPath(path);
      tabs.resetToTree();
    },
    [tabs.resetToTree],
  );

  useEffect(() => {
    void window.doru.getCurrentProject().then((path) => {
      if (path) {
        startProject(path);
      } else {
        setProjectPath(null);
      }
    });
  }, [startProject]);

  useEffect(() => {
    return window.doru.onProjectBound((info) => {
      startProject(info.path);
    });
  }, [startProject]);

  useEffect(() => {
    const removeOpen = commands.register({
      id: 'workbench.openProject',
      title: nls.t('workbench.openProject'),
      handler: () => project.openProject(),
    });
    const removeUndo = commands.register({
      id: 'tree.undo',
      title: nls.t('workbench.undo'),
      handler: () => tree.undo(),
    });
    const removeRedo = commands.register({
      id: 'tree.redo',
      title: nls.t('workbench.redo'),
      handler: () => tree.redo(),
    });
    return () => {
      removeOpen.dispose();
      removeUndo.dispose();
      removeRedo.dispose();
    };
  }, [commands, project.openProject, tree.undo, tree.redo]);

  const keybindings = useMemo(
    () => [
      { key: 'meta+z', command: 'tree.undo' },
      { key: 'ctrl+z', command: 'tree.undo' },
      { key: 'meta+shift+z', command: 'tree.redo' },
      { key: 'ctrl+shift+z', command: 'tree.redo' },
    ],
    [],
  );

  const handleSelectView = useCallback(
    (view: ActivityViewId) => {
      setActiveView(view);
      if (view === 'tree' && projectPath) {
        tabs.openTab({ id: TREE_TAB_ID, label: nls.t('features.tree.title') });
      }
    },
    [tabs.openTab, projectPath],
  );

  const renderTabContent = (tab: { id: string }): ReactNode => {
    if (tab.id === TREE_TAB_ID) {
      return (
        <TreeView
          persons={tree.persons}
          stats={tree.stats}
          importResult={project.importResult}
          exportResult={project.exportResult}
          search={tree.search}
          canUndo={tree.undoState.canUndo}
          canRedo={tree.undoState.canRedo}
          onSearch={tree.onSearch}
          onUndo={() => void tree.undo()}
          onRedo={() => void tree.redo()}
          onImportGedcom={() => void project.importGedcom()}
          onExportGedcom={() => void project.exportGedcom()}
          onAddPerson={tabs.openNewPersonTab}
          onOpenPerson={tabs.openPersonTab}
          getGedcomText={tree.getGedcomText}
        />
      );
    }
    if (tab.id === SETTINGS_TAB_ID) {
      return (
        <SettingsView
          providers={settings.aiProviders}
          settings={settings.aiSettings}
          onSave={settings.saveSettings}
          onTest={(options) => window.doru.testAiConnection(options)}
          onFetchModels={(options) => window.doru.fetchAiModels(options)}
        />
      );
    }
    if (tab.id.startsWith(PERSON_TAB_PREFIX)) {
      return (
        <PersonTab
          tabId={tab.id}
          persons={tree.persons}
          api={tree.api}
          onClose={tabs.closeTab}
        />
      );
    }
    return null;
  };

  const editor =
    projectPath === undefined ? null : tabs.openTabs.length === 0 ? (
      <WelcomePage
        recent={project.recent}
        onCreateProject={() => void project.createProject()}
        onOpenProject={() => void project.openProject()}
        onOpenRecent={(path) => void project.openProject(path)}
      />
    ) : (
      <div className="editor-stack">
        {tabs.openTabs.map((tab) => (
          <div
            key={tab.id}
            className={tab.id === tabs.activeTabId ? 'editor-pane active' : 'editor-pane'}
          >
            {renderTabContent(tab)}
          </div>
        ))}
      </div>
    );

  if (projectPath === undefined) {
    return null;
  }

  return (
    <>
      <style id="doru-builtin-theme">{builtinThemeCss}</style>
      <Workbench
        commands={commands}
        keybindings={keybindings}
        title={projectPath ? projectName(projectPath) : nls.t('app.name')}
        platform={window.doru.platform}
        sidebar={
          <SidebarView
            activeView={activeView}
            persons={tree.persons}
            projectPath={projectPath}
            onOpenPerson={tabs.openPersonTab}
            onImportGedcom={() => void project.importGedcom()}
            onExportGedcom={() => void project.exportGedcom()}
          />
        }
        activeView={activeView}
        onSelectView={handleSelectView}
        editor={editor}
        secondarySidebar={
          <ChatPanel
            messages={chat.chatMessages}
            busy={chat.chatBusy}
            permission={chat.permission}
            onSend={(text) => void chat.sendChatMessage(text)}
            onPermission={(allow) => chat.respondPermission(allow)}
          />
        }
        tabs={tabs.tabInfos}
        activeTabId={tabs.activeTabId}
        onSelectTab={tabs.setActiveTabId}
        onCloseTab={tabs.closeTab}
        onReorderTab={tabs.reorderTabs}
        onOpenSettings={tabs.openSettingsTab}
      />
    </>
  );
}

function projectName(path: string): string {
  const parts = path.split(/[\\/]/);
  const base = parts[parts.length - 1] ?? path;
  return base.toLowerCase().endsWith('.doru') ? base.slice(0, -5) : base;
}

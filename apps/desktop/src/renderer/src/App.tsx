import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Save } from 'lucide-react';
import { CommandService } from '@doru/platform';
import { ChatPanel, EmptyEditorPage, SettingsView, TreeCanvas, WelcomePage } from '@doru/features';
import { Workbench, nls, type ActivityViewId } from '@doru/workbench';
import type { ProjectBinding } from '@doru/core';
import { PersonTab } from './components/PersonTab';
import { SidebarView } from './components/SidebarView';
import { useChat } from './hooks/useChat';
import { useAiSettings } from './hooks/useAiSettings';
import { useProject } from './hooks/useProject';
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
  const [projectUntitled, setProjectUntitled] = useState(false);
  const [untitledName, setUntitledName] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActivityViewId>('tree');
  const [canvasFocus, setCanvasFocus] = useState<{ personId: string; nonce: number } | null>(
    null,
  );

  const tree = useTreeData(projectPath);
  const chat = useChat(projectPath, tree.refreshTree);
  const ai = useAiSettings();
  const tabs = useTabs(tree.persons);
  const project = useProject(projectPath, tabs.ensureTreeTab);
  const theme = useTheme();
  const [version, setVersion] = useState('');

  useEffect(() => {
    void window.doru.getAbout().then((info) => setVersion(info.version));
  }, []);

  // Re-read the theme list whenever the Settings tab opens: user themes are
  // plain files in <userData>/themes and may appear/change at any time.
  useEffect(() => {
    if (tabs.activeTabId === SETTINGS_TAB_ID) {
      void theme.refreshThemes();
    }
  }, [tabs.activeTabId, theme.refreshThemes]);

  const commands = useMemo(() => new CommandService(), []);

  const startProject = useCallback(
    (info: ProjectBinding) => {
      setProjectPath(info.path);
      setProjectUntitled(info.untitled);
      setUntitledName(info.untitled ? info.name : null);
      tabs.resetToTree();
    },
    [tabs.resetToTree],
  );

  useEffect(() => {
    void window.doru.getCurrentProject().then((binding) => {
      if (binding) {
        startProject(binding);
      } else {
        setProjectPath(null);
        setProjectUntitled(false);
        setUntitledName(null);
      }
    });
  }, [startProject]);

  useEffect(() => {
    return window.doru.onProjectBound((info) => {
      startProject(info);
    });
  }, [startProject]);

  useEffect(() => {
    const removeOpen = commands.register({
      id: 'workbench.openProject',
      title: nls.t('workbench.openProject'),
      handler: () => project.openProject(),
    });
    const removeSave = commands.register({
      id: 'workbench.saveProject',
      title: nls.t('workbench.saveProject'),
      handler: () => project.saveProject(),
    });
    const removeCreate = commands.register({
      id: 'workbench.createProject',
      title: nls.t('workbench.createProject'),
      handler: () => project.createProject(),
    });
    const removeExport = commands.register({
      id: 'workbench.exportGedcom',
      title: nls.t('workbench.exportGedcom'),
      handler: () => project.exportGedcom(),
    });
    const removeOpenSettings = commands.register({
      id: 'workbench.openSettings',
      title: nls.t('workbench.settings'),
      handler: () => tabs.openSettingsTab(),
    });
    const removeNextTab = commands.register({
      id: 'workbench.nextTab',
      title: nls.t('workbench.nextTab'),
      handler: () => tabs.nextTab(),
    });
    const removePrevTab = commands.register({
      id: 'workbench.prevTab',
      title: nls.t('workbench.prevTab'),
      handler: () => tabs.prevTab(),
    });
    const removeSwitchToTab = commands.register({
      id: 'workbench.switchToTab',
      title: nls.t('workbench.switchToTab'),
      handler: (index) => tabs.openTabAt(Number(index) - 1),
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
      removeSave.dispose();
      removeCreate.dispose();
      removeExport.dispose();
      removeOpenSettings.dispose();
      removeNextTab.dispose();
      removePrevTab.dispose();
      removeSwitchToTab.dispose();
      removeUndo.dispose();
      removeRedo.dispose();
    };
  }, [
    commands,
    project.openProject,
    project.saveProject,
    project.createProject,
    project.exportGedcom,
    tabs.openSettingsTab,
    tabs.nextTab,
    tabs.prevTab,
    tabs.openTabAt,
    tree.undo,
    tree.redo,
  ]);

  useEffect(() => {
    return window.doru.onMenuToggleSecondarySideBar(() => {
      // The command is registered by the Workbench on the same CommandService.
      void commands.execute('workbench.toggleSecondarySideBar');
    });
  }, [commands]);

  const keybindings = useMemo(
    () => [
      { key: 'meta+z', command: 'tree.undo' },
      { key: 'ctrl+z', command: 'tree.undo' },
      { key: 'meta+shift+z', command: 'tree.redo' },
      { key: 'ctrl+shift+z', command: 'tree.redo' },
      { key: 'meta+s', command: 'workbench.saveProject' },
      { key: 'ctrl+s', command: 'workbench.saveProject' },
      { key: 'meta+o', command: 'workbench.openProject' },
      { key: 'ctrl+o', command: 'workbench.openProject' },
      { key: 'meta+n', command: 'workbench.createProject' },
      { key: 'ctrl+n', command: 'workbench.createProject' },
      { key: 'meta+,', command: 'workbench.openSettings' },
      { key: 'ctrl+,', command: 'workbench.openSettings' },
      { key: 'meta+shift+]', command: 'workbench.nextTab' },
      { key: 'meta+shift+[', command: 'workbench.prevTab' },
      { key: 'ctrl+tab', command: 'workbench.nextTab' },
      { key: 'ctrl+shift+tab', command: 'workbench.prevTab' },
      { key: 'meta+shift+e', command: 'workbench.exportGedcom' },
      { key: 'ctrl+shift+e', command: 'workbench.exportGedcom' },
      ...Array.from({ length: 9 }, (_, index) => [
        { key: `meta+${index + 1}`, command: 'workbench.switchToTab', args: [index + 1] },
        { key: `ctrl+${index + 1}`, command: 'workbench.switchToTab', args: [index + 1] },
      ]).flat(),
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

  /** Opens the person editor and refocuses the tree canvas on that person. */
  const openPersonAndFocus = useCallback(
    (personId: string) => {
      tabs.openPersonTab(personId);
      setCanvasFocus((current) => ({ personId, nonce: (current?.nonce ?? 0) + 1 }));
    },
    [tabs.openPersonTab],
  );

  const renderTabContent = (tab: { id: string }): ReactNode => {
    if (tab.id === TREE_TAB_ID) {
      // Keying by the project path resets canvas state (focus history,
      // direction) when the user switches projects.
      return (
        <TreeCanvas
          key={projectPath ?? 'none'}
          persons={tree.persons}
          families={tree.families}
          focusRequest={canvasFocus}
          api={{
            addRelative: tree.addRelative,
            deletePerson: tree.deletePerson,
            reparent: tree.reparent,
            updatePerson: tree.api.updatePerson,
            getPersonCounts: tree.personCounts,
            openEditor: tabs.openPersonTab,
            openNewPerson: tabs.openNewPersonTab,
          }}
        />
      );
    }
    if (tab.id === SETTINGS_TAB_ID) {
      return (
        <SettingsView
          theme={theme.theme}
          themes={theme.themes}
          onThemeChange={theme.selectTheme}
          onOpenLogs={() => void window.doru.openLogs()}
          onOpenThemesFolder={() => void window.doru.openThemesFolder()}
          version={version}
          ai={
            ai.settings
              ? {
                  settings: ai.settings,
                  providers: ai.providers,
                  test: ai.test,
                  fetchedModels: ai.fetchedModels,
                  onSetProvider: (id) => void ai.setProvider(id),
                  onSetModel: ai.setModel,
                  onSetBaseUrl: ai.setBaseUrl,
                  onSetReasoning: ai.setReasoning,
                  onSetApiKey: ai.setApiKey,
                  onClearApiKey: ai.clearApiKey,
                  onSetAcpCommand: ai.setAcpCommand,
                  onSetAcpArgs: ai.setAcpArgs,
                  onSetMcpServers: ai.setMcpServers,
                  onTest: () => void ai.runTest(),
                  onFetchModels: () => void ai.fetchModels(),
                }
              : null
          }
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
      projectPath === null ? (
        <WelcomePage
          recent={project.recent}
          onCreateProject={() => void project.createProject()}
          onOpenProject={() => void project.openProject()}
          onOpenRecent={(path) => void project.openProject(path)}
          onRemoveRecent={(path) => void project.removeRecent(path)}
        />
      ) : (
        // All tabs closed with a project open: show the wordmark and the
        // keyboard shortcuts instead of the welcome screen.
        <EmptyEditorPage platform={window.doru.platform} />
      )
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
      <style id="doru-builtin-theme">{theme.builtinThemeCss}</style>
      <Workbench
        commands={commands}
        keybindings={keybindings}
        title={
          projectPath
            ? projectUntitled
              ? `${untitledName ?? projectName(projectPath)} •`
              : projectName(projectPath)
            : nls.t('app.name')
        }
        platform={window.doru.platform}
        titleActions={
          projectUntitled ? (
            <button
              className="title-bar-action"
              title={nls.t('workbench.saveProject')}
              aria-label={nls.t('workbench.saveProject')}
              onClick={() => void project.saveProject()}
            >
              <Save size={16} aria-hidden="true" />
            </button>
          ) : undefined
        }
        sidebar={
          <SidebarView
            activeView={activeView}
            persons={tree.persons}
            projectPath={projectPath}
            onOpenPerson={openPersonAndFocus}
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
            onStop={chat.cancelChat}
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

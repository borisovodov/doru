import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { AppMenu, IconButton } from '@doru/ui';
import { ChatPanel, ChatSetupPlaceholder, EmptyEditorPage, WelcomePage } from '@doru/features';
import { Workbench, nls, type ActivityViewId } from '@doru/workbench';
import type { ProjectBinding } from '@doru/core';
import { SidebarView } from './components/SidebarView';
import { useChat } from './hooks/useChat';
import { useAiSettings } from './hooks/useAiSettings';
import { useProject } from './hooks/useProject';
import { useAppCommands } from './hooks/useAppCommands';
import { useTabs } from './hooks/useTabs';
import { useTheme } from './hooks/useTheme';
import { useTreeData } from './hooks/useTreeData';
import { renderTab } from './tabs/registry';
import { SETTINGS_TAB_ID, type TabRenderContext } from './tabs/types';

export function App() {
  const [projectPath, setProjectPath] = useState<string | null | undefined>(undefined);
  const [projectUntitled, setProjectUntitled] = useState(false);
  const [untitledName, setUntitledName] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActivityViewId>('tree');
  const [searchFocusNonce, setSearchFocusNonce] = useState(0);
  const [canvasFocus, setCanvasFocus] = useState<{ personId: string; nonce: number } | null>(null);

  const tree = useTreeData(projectPath);

  const personPhotos = useMemo(() => {
    const photos = new Map<string, string>();
    for (const media of tree.media) {
      for (const link of media.links ?? []) {
        if (link.targetType === 'person' && link.primary === true && link.exclude !== true) {
          photos.set(link.targetId, `doru-media://local/?path=${encodeURIComponent(media.absolutePath)}`);
        }
      }
    }
    return photos;
  }, [tree.media]);
  const chat = useChat(projectPath, tree.refreshTree);
  const ai = useAiSettings();
  const tabs = useTabs(
    tree.persons,
    tree.families,
    tree.sources,
    tree.places,
    tree.repositories,
    tree.submitters,
    tree.addresses,
    tree.todos,
    tree.titles,
    tree.media,
  );
  const project = useProject(projectPath, tabs.ensureTreeTab);
  const theme = useTheme();
  const { commands, keybindings } = useAppCommands(project, tabs, tree);
  const [version, setVersion] = useState('');

  useEffect(() => {
    void window.doru.getAbout().then((info) => setVersion(info.version));
  }, []);

  // Re-read the theme list whenever the Settings tab opens: user themes are
  // plain files in <userData>/themes and may appear/change at any time.
  // A configured local provider also quietly refreshes its model list.
  const settingsWasOpenRef = useRef(false);
  useEffect(() => {
    const isSettings = tabs.activeTabId === SETTINGS_TAB_ID;
    if (isSettings && !settingsWasOpenRef.current) {
      void theme.refreshThemes();
      ai.refreshModelsOnSettingsOpen();
    }
    settingsWasOpenRef.current = isSettings;
    // oxlint-disable-next-line react/exhaustive-deps -- stable callbacks; the hook object changes every render
  }, [tabs.activeTabId, theme.refreshThemes, ai.refreshModelsOnSettingsOpen]);

  const startProject = useCallback(
    (info: ProjectBinding) => {
      setProjectPath(info.path);
      setProjectUntitled(info.untitled);
      setUntitledName(info.untitled ? info.name : null);
      tabs.resetToTree();
    },
    // oxlint-disable-next-line react/exhaustive-deps -- the tabs hook object changes every render
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
    return window.doru.onMenuCommand((commandId) => {
      // Native macOS menu items execute the same renderer commands as the
      // in-window menu and the keybindings; they are registered by App and
      // the Workbench on the shared CommandService.
      void commands.execute(commandId).catch(() => undefined);
    });
  }, [commands]);

  const handleSelectView = useCallback(
    (view: ActivityViewId) => {
      setActiveView(view);
      if (view === 'search') {
        // Every selection of the Search view — the icon and the shortcut —
        // asks the sidebar to put the caret into the query field.
        setSearchFocusNonce((nonce) => nonce + 1);
      }
      if (view === 'tree' && projectPath) {
        tabs.openStatic.tree();
      }
    },
    // oxlint-disable-next-line react/exhaustive-deps -- the tabs hook object changes every render
    [tabs.openStatic.tree, projectPath],
  );

  /** Opens the person editor and refocuses the tree canvas on that person. */
  const openPersonAndFocus = useCallback(
    (personId: string) => {
      tabs.open.person(personId);
      setCanvasFocus((current) => ({ personId, nonce: (current?.nonce ?? 0) + 1 }));
    },
    // oxlint-disable-next-line react/exhaustive-deps -- the tabs hook object changes every render
    [tabs.open.person],
  );

  const tabContext: TabRenderContext = {
    tree,
    tabs,
    projectPath,
    personPhotos,
    canvasFocus,
    openPersonAndFocus,
    theme,
    ai,
    project,
    version,
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
          <div key={tab.id} className={tab.id === tabs.activeTabId ? 'editor-pane active' : 'editor-pane'}>
            {renderTab(tab.id, tabContext)}
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
        titleMenu={
          window.doru.platform === 'darwin' ? undefined : (
            <AppMenu
              commands={commands}
              platform={window.doru.platform}
              onMenuAction={(action) => void window.doru.menuAction(action)}
            />
          )
        }
        titleActions={
          projectUntitled ? (
            <IconButton
              className="title-bar-action"
              size="md"
              label={nls.t('workbench.saveProject')}
              icon={<Save size={16} aria-hidden="true" />}
              onClick={() => void project.saveProject()}
            />
          ) : undefined
        }
        sidebar={
          <SidebarView
            activeView={activeView}
            canCreate={projectPath !== null}
            searchFocusNonce={searchFocusNonce}
            activeTabId={tabs.activeTabId}
            persons={tree.persons}
            families={tree.families}
            facts={tree.facts}
            sources={tree.sources}
            media={tree.media}
            citations={tree.citations}
            notes={tree.notes}
            places={tree.places}
            repositories={tree.repositories}
            submitters={tree.submitters}
            tags={tree.tags}
            tagLinks={tree.tagLinks}
            addresses={tree.addresses}
            titles={tree.titles}
            todos={tree.todos}
            associations={tree.associations}
            onOpenPerson={openPersonAndFocus}
            onOpenMedia={tabs.open.media}
            onOpenFamily={tabs.open.family}
            onOpenSource={tabs.open.source}
            onOpenPlace={tabs.open.place}
            onOpenRepository={tabs.open.repository}
            onOpenSubmitter={tabs.open.submitter}
            onOpenAddress={tabs.open.address}
            onOpenTitle={tabs.open.title}
            onNewTitle={tabs.openNew.title}
            onNewPerson={tabs.openNew.person}
            onNewPlace={tabs.openNew.place}
            onNewMedia={() => void tree.addStandaloneMedia()}
            onNewSource={tabs.openNew.source}
            onNewRepository={tabs.openNew.repository}
            onNewSubmitter={tabs.openNew.submitter}
            onNewAddress={tabs.openNew.address}
            onOpenTask={tabs.open.task}
            onNewTask={tabs.openNew.task}
            onDeleteTag={(tag) => void tree.api.deleteTag(tag)}
          />
        }
        activeView={activeView}
        onSelectView={handleSelectView}
        editor={editor}
        agentChat={
          ai.settings === null ? null : ai.settings.configured ? (
            <ChatPanel
              messages={chat.chatMessages}
              busy={chat.chatBusy}
              sessions={chat.sessions}
              activeSessionId={chat.activeSessionId}
              onSend={(text) => void chat.sendChatMessage(text)}
              onStop={chat.cancelChat}
              onSelectSession={(id) => void chat.switchSession(id)}
              onNewSession={() => void chat.newSession()}
              onDeleteSession={(id) => void chat.deleteSession(id)}
              onCopy={(text) => void window.doru.copyText(text)}
              onOpenLink={(url) => void window.doru.openExternal(url)}
            />
          ) : (
            <ChatSetupPlaceholder onOpenSettings={tabs.openStatic.settings} />
          )
        }
        tabs={tabs.tabInfos}
        activeTabId={tabs.activeTabId}
        onSelectTab={tabs.setActiveTabId}
        onCloseTab={tabs.closeTab}
        onReorderTab={tabs.reorderTabs}
        onOpenSettings={tabs.openStatic.settings}
      />
    </>
  );
}

function projectName(path: string): string {
  const parts = path.split(/[\\/]/);
  const base = parts[parts.length - 1] ?? path;
  return base.toLowerCase().endsWith('.doru') ? base.slice(0, -5) : base;
}

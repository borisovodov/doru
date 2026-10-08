import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '@doru/ai';
import type {
  EventRecord,
  FamilyRecord,
  GedcomImportResult,
  MediaRecord,
  NoteRecord,
  PersonRecord,
  ProjectSummary,
  RecentProject,
  SourceRecord,
  TreeStats,
  UndoRedoState,
} from '@doru/core';
import { CommandService } from '@doru/platform';
import {
  ChatPanel,
  RecentList,
  SettingsView,
  TreeView,
  type AiProviderInfo,
  type AiSettingsState,
  type ChatPermissionRequest,
  type ChatTranscriptMessage,
  type MediaWithPath,
  type NameFormat,
} from '@doru/features';
import { Workbench, nls, type TabInfo } from '@doru/workbench';
import type { ChatPermissionRequest as PreloadPermissionRequest } from './doru.d';

const NO_UNDO: UndoRedoState = { canUndo: false, canRedo: false };

export function App() {
  const [tabs, setTabs] = useState<ProjectSummary[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [persons, setPersons] = useState<PersonRecord[]>([]);
  const [stats, setStats] = useState<TreeStats | null>(null);
  const [undoState, setUndoState] = useState<UndoRedoState>(NO_UNDO);
  const [importResult, setImportResult] = useState<GedcomImportResult | null>(null);
  const [exportResult, setExportResult] = useState<{ path: string } | null>(null);
  const [search, setSearch] = useState('');
  const [nameFormat, setNameFormat] = useState<NameFormat>('given-first');
  const [chatMessages, setChatMessages] = useState<ChatTranscriptMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [permission, setPermission] = useState<ChatPermissionRequest | null>(null);
  const [themeCss, setThemeCss] = useState('');
  const [builtinThemeCss, setBuiltinThemeCss] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiSettingsState | null>(null);
  const [aiProviders, setAiProviders] = useState<AiProviderInfo[]>([]);
  const commands = useMemo(() => new CommandService(), []);
  const chatConversation = useRef<ChatMessage[]>([]);

  const applyBuiltinTheme = useCallback(async (systemDark: boolean, config: { dark: string; light: string }) => {
    const name = systemDark ? config.dark : config.light;
    setBuiltinThemeCss(await window.doru.getThemeCss(name));
  }, []);

  useEffect(() => {
    void (async () => {
      const state = await window.doru.getThemeState();
      await applyBuiltinTheme(state.systemDark, state.config);
    })();
    return window.doru.onThemeSystemChanged((info) => {
      void window.doru.getThemeState().then((state) => applyBuiltinTheme(info.systemDark, state.config));
    });
  }, [applyBuiltinTheme]);

  useEffect(() => {
    return window.doru.onThemeConfigChanged((config) => {
      void window.doru.getThemeState().then((state) => applyBuiltinTheme(state.systemDark, config));
    });
  }, [applyBuiltinTheme]);

  const refreshRecent = useCallback(async () => {
    setRecent(await window.doru.recentProjects());
  }, []);

  const reloadTree = useCallback(async (path: string, query: string) => {
    const [list, treeStats, undo] = await Promise.all([
      window.doru.listPersons(path, query),
      window.doru.treeStats(path),
      window.doru.getUndoState(path),
    ]);
    setPersons(list);
    setStats(treeStats);
    setUndoState(undo);
  }, []);

  useEffect(() => {
    if (activePath) {
      setSearch('');
      setImportResult(null);
      setExportResult(null);
      setChatMessages([]);
      setPermission(null);
      chatConversation.current = [];
      void reloadTree(activePath, '');
      void window.doru.getTheme(activePath).then((result) => setThemeCss(result.css));
      void window.doru
        .getProjectSettings(activePath)
        .then((settings) => setNameFormat(settings.nameFormat));
    } else {
      setPersons([]);
      setStats(null);
      setUndoState(NO_UNDO);
      setThemeCss('');
    }
  }, [activePath, reloadTree]);

  useEffect(() => {
    return window.doru.onThemeChanged((info) => {
      if (info.projectPath === activePath) {
        void window.doru.getTheme(info.projectPath).then((result) => setThemeCss(result.css));
      }
    });
  }, [activePath]);

  const openProject = useCallback(
    async (path?: string) => {
      const result = path
        ? await window.doru.openProjectPath(path)
        : await window.doru.openProjectDialog();
      if (!result) {
        return;
      }
      setTabs((previous) =>
        previous.some((tab) => tab.path === result.path) ? previous : [...previous, result],
      );
      setActivePath(result.path);
      void refreshRecent();
    },
    [refreshRecent],
  );

  const closeTab = useCallback(
    async (path: string) => {
      await window.doru.closeProject(path);
      setTabs((previous) => previous.filter((tab) => tab.path !== path));
      setActivePath((current) => {
        if (current !== path) {
          return current;
        }
        const remaining = tabs.filter((tab) => tab.path !== path);
        return remaining.length > 0 ? (remaining[remaining.length - 1]?.path ?? null) : null;
      });
    },
    [tabs],
  );

  const importGedcom = useCallback(async () => {
    if (!activePath) {
      return;
    }
    const result = await window.doru.importGedcom(activePath);
    setImportResult(result);
    if (result) {
      void reloadTree(activePath, search);
    }
  }, [activePath, search, reloadTree]);

  const exportGedcom = useCallback(async () => {
    if (!activePath) {
      return;
    }
    setExportResult(await window.doru.exportGedcom(activePath));
  }, [activePath]);

  const addPerson = useCallback(
    async (person: PersonRecord) => {
      if (!activePath) {
        return;
      }
      setUndoState(await window.doru.addPerson(activePath, person));
      void reloadTree(activePath, search);
    },
    [activePath, search, reloadTree],
  );

  const updatePerson = useCallback(
    async (before: PersonRecord, after: PersonRecord) => {
      if (!activePath) {
        return;
      }
      setUndoState(await window.doru.updatePerson(activePath, before, after));
      void reloadTree(activePath, search);
    },
    [activePath, search, reloadTree],
  );

  const onSearch = useCallback(
    (query: string) => {
      setSearch(query);
      if (activePath) {
        void reloadTree(activePath, query);
      }
    },
    [activePath, reloadTree],
  );

  const undo = useCallback(async () => {
    if (!activePath) {
      return;
    }
    setUndoState(await window.doru.undo(activePath));
    void reloadTree(activePath, search);
  }, [activePath, search, reloadTree]);

  const redo = useCallback(async () => {
    if (!activePath) {
      return;
    }
    setUndoState(await window.doru.redo(activePath));
    void reloadTree(activePath, search);
  }, [activePath, search, reloadTree]);

  const sendChatMessage = useCallback(
    async (text: string) => {
      if (!activePath || chatBusy) {
        return;
      }
      const userMessage: ChatMessage = { role: 'user', content: text };
      chatConversation.current = [...chatConversation.current.slice(-20), userMessage];
      setChatMessages((previous) => [
        ...previous,
        { role: 'user', content: text },
        { role: 'assistant', content: '' },
      ]);
      setChatBusy(true);
      try {
        const result = await window.doru.sendChat(activePath, chatConversation.current);
        setChatMessages((previous) => {
          const next = [...previous];
          next[next.length - 1] = {
            role: 'assistant',
            content: result.finalText,
            steps: result.steps,
            error: result.error,
          };
          return next;
        });
        chatConversation.current.push({ role: 'assistant', content: result.finalText || '' });
      } finally {
        setChatBusy(false);
      }
      void reloadTree(activePath, search);
    },
    [activePath, chatBusy, reloadTree, search],
  );

  const respondPermission = useCallback(
    (allow: boolean) => {
      if (!permission) {
        return;
      }
      window.doru.respondChatPermission(permission.id, allow);
      setPermission(null);
    },
    [permission],
  );

  const getNotes = useCallback(
    async (personId: string): Promise<NoteRecord[]> => {
      if (!activePath) {
        return [];
      }
      return window.doru.listNotes(activePath, personId);
    },
    [activePath],
  );

  const addNote = useCallback(
    async (personId: string, text: string) => {
      if (!activePath) {
        return;
      }
      setUndoState(
        await window.doru.addNote(activePath, {
          id: crypto.randomUUID(),
          text,
          targetType: 'person',
          targetId: personId,
        }),
      );
    },
    [activePath],
  );

  useEffect(() => {
    void (async () => {
      const session = await window.doru.getSession();
      for (const path of session.paths) {
        await openProject(path);
      }
      const active = session.activePath ?? session.paths[session.paths.length - 1];
      if (active) {
        setActivePath(active);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getGedcomText = useCallback(async (): Promise<string> => {
    if (!activePath) {
      return '';
    }
    return window.doru.getGedcomText(activePath);
  }, [activePath]);

  const getFamilies = useCallback(async (): Promise<FamilyRecord[]> => {
    if (!activePath) {
      return [];
    }
    return window.doru.getFamilies(activePath);
  }, [activePath]);

  const addFamily = useCallback(
    async (family: FamilyRecord) => {
      if (!activePath) {
        return;
      }
      setUndoState(await window.doru.addFamily(activePath, family));
    },
    [activePath],
  );

  const updateFamily = useCallback(
    async (before: FamilyRecord, after: FamilyRecord) => {
      if (!activePath) {
        return;
      }
      setUndoState(await window.doru.updateFamily(activePath, before, after));
    },
    [activePath],
  );

  const deleteFamily = useCallback(
    async (family: FamilyRecord) => {
      if (!activePath) {
        return;
      }
      setUndoState(await window.doru.deleteFamily(activePath, family));
    },
    [activePath],
  );

  const getSources = useCallback(async (): Promise<SourceRecord[]> => {
    if (!activePath) {
      return [];
    }
    return window.doru.getSources(activePath);
  }, [activePath]);

  const getCitations = useCallback(
    async (personId: string) => {
      if (!activePath) {
        return [];
      }
      return window.doru.getCitations(activePath, personId);
    },
    [activePath],
  );

  const addSource = useCallback(
    async (source: SourceRecord, targetId: string) => {
      if (!activePath) {
        return;
      }
      setUndoState(await window.doru.addSource(activePath, source, 'person', targetId));
    },
    [activePath],
  );

  const attachSource = useCallback(
    async (sourceId: string, targetId: string) => {
      if (!activePath) {
        return;
      }
      setUndoState(await window.doru.attachSource(activePath, sourceId, 'person', targetId));
    },
    [activePath],
  );

  const detachCitation = useCallback(
    async (citationId: string) => {
      if (!activePath) {
        return;
      }
      setUndoState(await window.doru.detachCitation(activePath, citationId));
    },
    [activePath],
  );

  const getEvents = useCallback(
    async (personId?: string, familyId?: string): Promise<EventRecord[]> => {
      if (!activePath) {
        return [];
      }
      return window.doru.getEvents(activePath, personId, familyId);
    },
    [activePath],
  );

  const addEvent = useCallback(
    async (event: EventRecord) => {
      if (!activePath) {
        return;
      }
      setUndoState(await window.doru.addEvent(activePath, event));
    },
    [activePath],
  );

  const deleteEvent = useCallback(
    async (event: EventRecord) => {
      if (!activePath) {
        return;
      }
      setUndoState(await window.doru.deleteEvent(activePath, event));
    },
    [activePath],
  );

  const getMedia = useCallback(
    async (personId: string): Promise<MediaWithPath[]> => {
      if (!activePath) {
        return [];
      }
      return window.doru.getMedia(activePath, personId);
    },
    [activePath],
  );

  const addMedia = useCallback(
    async (personId: string) => {
      if (!activePath) {
        return;
      }
      const added = await window.doru.addMedia(activePath, personId);
      if (added.length > 0) {
        setUndoState(await window.doru.getUndoState(activePath));
      }
    },
    [activePath],
  );

  const deleteMedia = useCallback(
    async (media: MediaRecord) => {
      if (!activePath) {
        return;
      }
      setUndoState(await window.doru.deleteMedia(activePath, media));
    },
    [activePath],
  );

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  useEffect(() => {
    void (async () => {
      const [settings, providers] = await Promise.all([
        window.doru.getAiSettings(),
        window.doru.getAiProviders(),
      ]);
      setAiSettings(settings);
      setAiProviders(providers);
    })();
  }, []);

  useEffect(() => {
    return window.doru.onChatPermission((request: PreloadPermissionRequest) => {
      setPermission(request);
    });
  }, []);

  useEffect(() => {
    return window.doru.onExternalOpen((summary) => {
      setTabs((previous) =>
        previous.some((tab) => tab.path === summary.path) ? previous : [...previous, summary],
      );
      setActivePath(summary.path);
      void refreshRecent();
    });
  }, [refreshRecent]);

  useEffect(() => {
    const removeOpen = commands.register({
      id: 'workbench.openProject',
      title: nls.t('workbench.openProject'),
      handler: () => openProject(),
    });
    const removeUndo = commands.register({
      id: 'tree.undo',
      title: nls.t('workbench.undo'),
      handler: () => undo(),
    });
    const removeRedo = commands.register({
      id: 'tree.redo',
      title: nls.t('workbench.redo'),
      handler: () => redo(),
    });
    return () => {
      removeOpen.dispose();
      removeUndo.dispose();
      removeRedo.dispose();
    };
  }, [commands, openProject, undo, redo]);

  const keybindings = useMemo(
    () => [
      { key: 'meta+z', command: 'tree.undo' },
      { key: 'ctrl+z', command: 'tree.undo' },
      { key: 'meta+shift+z', command: 'tree.redo' },
      { key: 'ctrl+shift+z', command: 'tree.redo' },
    ],
    [],
  );

  const activeSummary = tabs.find((tab) => tab.path === activePath) ?? null;
  const tabInfos: TabInfo[] = tabs.map((tab) => ({ id: tab.path, label: basename(tab.path) }));

  const editor = showSettings ? (
    <SettingsView
      providers={aiProviders}
      settings={aiSettings}
      onSave={async (options) => {
        const next = await window.doru.setAiSettings(options);
        setAiSettings(next);
        return next;
      }}
      onTest={(options) => window.doru.testAiConnection(options)}
      onFetchModels={(options) => window.doru.fetchAiModels(options)}
    />
  ) : (
    <TreeView
      summary={activeSummary}
      persons={activeSummary ? persons : []}
      stats={activeSummary ? stats : null}
      importResult={activeSummary ? importResult : null}
      exportResult={activeSummary ? exportResult : null}
      search={search}
      canUndo={undoState.canUndo}
      canRedo={undoState.canRedo}
      nameFormat={nameFormat}
      onOpenProject={() => void openProject()}
      onImportGedcom={() => void importGedcom()}
      onExportGedcom={() => void exportGedcom()}
      onSearch={onSearch}
      onUndo={() => void undo()}
      onRedo={() => void redo()}
      onAddPerson={(person) => addPerson(person)}
      onUpdatePerson={(before, after) => updatePerson(before, after)}
      getNotes={getNotes}
      onAddNote={(personId, text) => addNote(personId, text)}
      getGedcomText={getGedcomText}
      getFamilies={getFamilies}
      onAddFamily={(family) => addFamily(family)}
      onUpdateFamily={(before, after) => updateFamily(before, after)}
      onDeleteFamily={(family) => deleteFamily(family)}
      getSources={getSources}
      getCitations={getCitations}
      onAddSource={(source, targetId) => addSource(source, targetId)}
      onAttachSource={(sourceId, targetId) => attachSource(sourceId, targetId)}
      onDetachCitation={(citationId) => detachCitation(citationId)}
      getEvents={getEvents}
      onAddEvent={(event) => addEvent(event)}
      onDeleteEvent={(event) => deleteEvent(event)}
      getMedia={getMedia}
      onAddMedia={(personId) => addMedia(personId)}
      onDeleteMedia={(media) => deleteMedia(media)}
    />
  );

  return (
    <>
      <style id="doru-builtin-theme">{builtinThemeCss}</style>
      <style id="doru-project-theme">{themeCss}</style>
      <Workbench
        commands={commands}
        keybindings={keybindings}
        sidebar={
          <RecentList
            projects={recent}
            onOpen={(path) => void openProject(path)}
            onBrowse={() => void openProject()}
          />
        }
        editor={editor}
        panel={
          <ChatPanel
            messages={chatMessages}
            busy={chatBusy}
            permission={permission}
            onSend={(text) => void sendChatMessage(text)}
            onPermission={(allow) => respondPermission(allow)}
          />
        }
        tabs={tabInfos}
        activeTabId={activePath}
        onSelectTab={setActivePath}
        onCloseTab={(id) => void closeTab(id)}
        statusText={activeSummary ? activeSummary.path : nls.t('workbench.statusBar.ready')}
        onOpenProject={() => void openProject()}
        onOpenSettings={() => setShowSettings((value) => !value)}
      />
    </>
  );
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

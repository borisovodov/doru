import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ChatMessage } from '@doru/ai';
import type {
  EventRecord,
  FamilyRecord,
  GedcomImportResult,
  MediaRecord,
  NoteRecord,
  PersonRecord,
  RecentProject,
  SourceRecord,
  TreeStats,
  UndoRedoState,
} from '@doru/core';
import { CommandService } from '@doru/platform';
import {
  ChatPanel,
  PersonEditor,
  PersonList,
  PlaceholderView,
  SettingsView,
  TreeView,
  WelcomePage,
  displayName,
  draftToRecord,
  newPersonDraft,
  personDraftMatches,
  personToDraft,
  type AiProviderInfo,
  type AiSettingsState,
  type ChatPermissionRequest,
  type ChatTranscriptMessage,
  type MediaWithPath,
  type PersonDraft,
} from '@doru/features';
import { Workbench, nls, type ActivityViewId, type TabInfo } from '@doru/workbench';
import type { ChatPermissionRequest as PreloadPermissionRequest } from './doru.d';

const NO_UNDO: UndoRedoState = { canUndo: false, canRedo: false };
const TREE_TAB_ID = 'tree';
const SETTINGS_TAB_ID = 'settings';
const PERSON_TAB_PREFIX = 'person:';

interface OpenTab {
  id: string;
  label: string;
  closable: boolean;
}

interface PersonTabProps {
  tabId: string;
  persons: PersonRecord[];
  onClose: (tabId: string) => void;
  onAddPerson: (person: PersonRecord) => Promise<void>;
  onUpdatePerson: (before: PersonRecord, after: PersonRecord) => Promise<void>;
  getNotes: (personId: string) => Promise<NoteRecord[]>;
  onAddNote: (personId: string, text: string) => Promise<void>;
  getFamilies: () => Promise<FamilyRecord[]>;
  onAddFamily: (family: FamilyRecord) => Promise<void>;
  onUpdateFamily: (before: FamilyRecord, after: FamilyRecord) => Promise<void>;
  onDeleteFamily: (family: FamilyRecord) => Promise<void>;
  getSources: () => Promise<SourceRecord[]>;
  getCitations: (personId: string) => Promise<{ id: string; source: SourceRecord }[]>;
  onAddSource: (source: SourceRecord, targetId: string) => Promise<void>;
  onAttachSource: (sourceId: string, targetId: string) => Promise<void>;
  onDetachCitation: (citationId: string) => Promise<void>;
  getEvents: (personId?: string, familyId?: string) => Promise<EventRecord[]>;
  onAddEvent: (event: EventRecord) => Promise<void>;
  onDeleteEvent: (event: EventRecord) => Promise<void>;
  getMedia: (personId: string) => Promise<MediaWithPath[]>;
  onAddMedia: (personId: string) => Promise<void>;
  onDeleteMedia: (media: MediaRecord) => Promise<void>;
}

function PersonTab(props: PersonTabProps) {
  const personId = props.tabId.slice(PERSON_TAB_PREFIX.length);
  const isNew = personId.startsWith('new:');
  const record = props.persons.find((person) => person.id === personId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tree.personNotFound')}</p>;
  }
  return <PersonTabBody {...props} personId={personId} isNew={isNew} />;
}

function PersonTabBody({
  tabId,
  personId,
  isNew,
  persons,
  onClose,
  onAddPerson,
  onUpdatePerson,
  getNotes,
  onAddNote,
  getFamilies,
  onAddFamily,
  onUpdateFamily,
  onDeleteFamily,
  getSources,
  getCitations,
  onAddSource,
  onAttachSource,
  onDetachCitation,
  getEvents,
  onAddEvent,
  onDeleteEvent,
  getMedia,
  onAddMedia,
  onDeleteMedia,
}: PersonTabProps & { personId: string; isNew: boolean }) {
  const record = persons.find((person) => person.id === personId);
  const [draft, setDraft] = useState<PersonDraft>(() =>
    isNew ? newPersonDraft() : record ? personToDraft(record) : newPersonDraft(),
  );

  useEffect(() => {
    if (isNew) {
      return;
    }
    const person = persons.find((entry) => entry.id === personId);
    if (!person) {
      return;
    }
    setDraft((current) =>
      current && !current.isNew && personDraftMatches(current, person) ? current : personToDraft(person),
    );
  }, [personId, persons, isNew]);

  const save = async () => {
    const next = draftToRecord(draft);
    if (draft.isNew) {
      await onAddPerson(next);
      onClose(tabId);
      return;
    }
    const before = persons.find((entry) => entry.id === draft.id);
    if (before) {
      await onUpdatePerson(before, next);
    }
  };

  return (
    <PersonEditor
      draft={draft}
      persons={persons}
      onChange={setDraft}
      onSave={() => void save()}
      onCancel={draft.isNew ? () => onClose(tabId) : undefined}
      getNotes={getNotes}
      onAddNote={onAddNote}
      getFamilies={getFamilies}
      onAddFamily={onAddFamily}
      onUpdateFamily={onUpdateFamily}
      onDeleteFamily={onDeleteFamily}
      getSources={getSources}
      getCitations={getCitations}
      onAddSource={onAddSource}
      onAttachSource={onAttachSource}
      onDetachCitation={onDetachCitation}
      getEvents={getEvents}
      onAddEvent={onAddEvent}
      onDeleteEvent={onDeleteEvent}
      getMedia={getMedia}
      onAddMedia={onAddMedia}
      onDeleteMedia={onDeleteMedia}
    />
  );
}

export function App() {
  const [projectPath, setProjectPath] = useState<string | null | undefined>(undefined);
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [persons, setPersons] = useState<PersonRecord[]>([]);
  const [stats, setStats] = useState<TreeStats | null>(null);
  const [undoState, setUndoState] = useState<UndoRedoState>(NO_UNDO);
  const [importResult, setImportResult] = useState<GedcomImportResult | null>(null);
  const [exportResult, setExportResult] = useState<{ path: string } | null>(null);
  const [search, setSearch] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatTranscriptMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [permission, setPermission] = useState<ChatPermissionRequest | null>(null);
  const [builtinThemeCss, setBuiltinThemeCss] = useState('');
  const [activeView, setActiveView] = useState<ActivityViewId>('tree');
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
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

  useEffect(() => {
    void window.doru.getCurrentProject().then((path) => {
      if (path) {
        startProject(path);
      } else {
        setProjectPath(null);
      }
    });
  }, []);

  useEffect(() => {
    return window.doru.onProjectBound((info) => {
      startProject(info.path);
    });
  }, []);

  const startProject = useCallback((path: string) => {
    setProjectPath(path);
    setOpenTabs([{ id: TREE_TAB_ID, label: nls.t('features.tree.title'), closable: true }]);
    setActiveTabId(TREE_TAB_ID);
  }, []);

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
    if (!projectPath) {
      setPersons([]);
      setStats(null);
      setUndoState(NO_UNDO);
      return;
    }
    setSearch('');
    setImportResult(null);
    setExportResult(null);
    setChatMessages([]);
    setPermission(null);
    chatConversation.current = [];
    void reloadTree(projectPath, '');
  }, [projectPath, reloadTree]);

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

  const openProject = useCallback(
    async (path?: string) => {
      if (path) {
        const summary = await window.doru.openProjectPath(path);
        if (summary && projectPath && summary.path === projectPath) {
          setOpenTabs((current) =>
            current.some((entry) => entry.id === TREE_TAB_ID)
              ? current
              : [...current, { id: TREE_TAB_ID, label: nls.t('features.tree.title'), closable: true }],
          );
          setActiveTabId(TREE_TAB_ID);
        }
      } else {
        await window.doru.openProjectDialog();
      }
      void refreshRecent();
    },
    [projectPath, refreshRecent],
  );

  const createProject = useCallback(async () => {
    await window.doru.createProjectDialog();
    void refreshRecent();
  }, [refreshRecent]);

  const importGedcom = useCallback(async () => {
    if (!projectPath) {
      return;
    }
    const result = await window.doru.importGedcom(projectPath);
    setImportResult(result);
    if (result) {
      void reloadTree(projectPath, search);
    }
  }, [projectPath, search, reloadTree]);

  const exportGedcom = useCallback(async () => {
    if (!projectPath) {
      return;
    }
    setExportResult(await window.doru.exportGedcom(projectPath));
  }, [projectPath]);

  const addPerson = useCallback(
    async (person: PersonRecord) => {
      if (!projectPath) {
        return;
      }
      setUndoState(await window.doru.addPerson(projectPath, person));
      void reloadTree(projectPath, search);
    },
    [projectPath, search, reloadTree],
  );

  const updatePerson = useCallback(
    async (before: PersonRecord, after: PersonRecord) => {
      if (!projectPath) {
        return;
      }
      setUndoState(await window.doru.updatePerson(projectPath, before, after));
      void reloadTree(projectPath, search);
    },
    [projectPath, search, reloadTree],
  );

  const onSearch = useCallback(
    (query: string) => {
      setSearch(query);
      if (projectPath) {
        void reloadTree(projectPath, query);
      }
    },
    [projectPath, reloadTree],
  );

  const undo = useCallback(async () => {
    if (!projectPath) {
      return;
    }
    setUndoState(await window.doru.undo(projectPath));
    void reloadTree(projectPath, search);
  }, [projectPath, search, reloadTree]);

  const redo = useCallback(async () => {
    if (!projectPath) {
      return;
    }
    setUndoState(await window.doru.redo(projectPath));
    void reloadTree(projectPath, search);
  }, [projectPath, search, reloadTree]);

  const sendChatMessage = useCallback(
    async (text: string) => {
      if (!projectPath || chatBusy) {
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
        const result = await window.doru.sendChat(projectPath, chatConversation.current);
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
      void reloadTree(projectPath, search);
    },
    [projectPath, chatBusy, reloadTree, search],
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
      if (!projectPath) {
        return [];
      }
      return window.doru.listNotes(projectPath, personId);
    },
    [projectPath],
  );

  const addNote = useCallback(
    async (personId: string, text: string) => {
      if (!projectPath) {
        return;
      }
      setUndoState(
        await window.doru.addNote(projectPath, {
          id: crypto.randomUUID(),
          text,
          targetType: 'person',
          targetId: personId,
        }),
      );
    },
    [projectPath],
  );

  const getGedcomText = useCallback(async (): Promise<string> => {
    if (!projectPath) {
      return '';
    }
    return window.doru.getGedcomText(projectPath);
  }, [projectPath]);

  const getFamilies = useCallback(async (): Promise<FamilyRecord[]> => {
    if (!projectPath) {
      return [];
    }
    return window.doru.getFamilies(projectPath);
  }, [projectPath]);

  const addFamily = useCallback(
    async (family: FamilyRecord) => {
      if (!projectPath) {
        return;
      }
      setUndoState(await window.doru.addFamily(projectPath, family));
    },
    [projectPath],
  );

  const updateFamily = useCallback(
    async (before: FamilyRecord, after: FamilyRecord) => {
      if (!projectPath) {
        return;
      }
      setUndoState(await window.doru.updateFamily(projectPath, before, after));
    },
    [projectPath],
  );

  const deleteFamily = useCallback(
    async (family: FamilyRecord) => {
      if (!projectPath) {
        return;
      }
      setUndoState(await window.doru.deleteFamily(projectPath, family));
    },
    [projectPath],
  );

  const getSources = useCallback(async (): Promise<SourceRecord[]> => {
    if (!projectPath) {
      return [];
    }
    return window.doru.getSources(projectPath);
  }, [projectPath]);

  const getCitations = useCallback(
    async (personId: string) => {
      if (!projectPath) {
        return [];
      }
      return window.doru.getCitations(projectPath, personId);
    },
    [projectPath],
  );

  const addSource = useCallback(
    async (source: SourceRecord, targetId: string) => {
      if (!projectPath) {
        return;
      }
      setUndoState(await window.doru.addSource(projectPath, source, 'person', targetId));
    },
    [projectPath],
  );

  const attachSource = useCallback(
    async (sourceId: string, targetId: string) => {
      if (!projectPath) {
        return;
      }
      setUndoState(await window.doru.attachSource(projectPath, sourceId, 'person', targetId));
    },
    [projectPath],
  );

  const detachCitation = useCallback(
    async (citationId: string) => {
      if (!projectPath) {
        return;
      }
      setUndoState(await window.doru.detachCitation(projectPath, citationId));
    },
    [projectPath],
  );

  const getEvents = useCallback(
    async (personId?: string, familyId?: string): Promise<EventRecord[]> => {
      if (!projectPath) {
        return [];
      }
      return window.doru.getEvents(projectPath, personId, familyId);
    },
    [projectPath],
  );

  const addEvent = useCallback(
    async (event: EventRecord) => {
      if (!projectPath) {
        return;
      }
      setUndoState(await window.doru.addEvent(projectPath, event));
    },
    [projectPath],
  );

  const deleteEvent = useCallback(
    async (event: EventRecord) => {
      if (!projectPath) {
        return;
      }
      setUndoState(await window.doru.deleteEvent(projectPath, event));
    },
    [projectPath],
  );

  const getMedia = useCallback(
    async (personId: string): Promise<MediaWithPath[]> => {
      if (!projectPath) {
        return [];
      }
      return window.doru.getMedia(projectPath, personId);
    },
    [projectPath],
  );

  const addMedia = useCallback(
    async (personId: string) => {
      if (!projectPath) {
        return;
      }
      const added = await window.doru.addMedia(projectPath, personId);
      if (added.length > 0) {
        setUndoState(await window.doru.getUndoState(projectPath));
      }
    },
    [projectPath],
  );

  const deleteMedia = useCallback(
    async (media: MediaRecord) => {
      if (!projectPath) {
        return;
      }
      setUndoState(await window.doru.deleteMedia(projectPath, media));
    },
    [projectPath],
  );

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

  const openTab = useCallback((tab: { id: string; label: string }) => {
    setOpenTabs((current) =>
      current.some((entry) => entry.id === tab.id)
        ? current
        : [...current, { ...tab, closable: true }],
    );
    setActiveTabId(tab.id);
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      const index = openTabs.findIndex((entry) => entry.id === id);
      if (index === -1) {
        return;
      }
      const remaining = openTabs.filter((entry) => entry.id !== id);
      setOpenTabs(remaining);
      setActiveTabId((active) => {
        if (active !== id) {
          return active;
        }
        if (remaining.length === 0) {
          return null;
        }
        return remaining[Math.min(index, remaining.length - 1)]?.id ?? null;
      });
    },
    [openTabs],
  );

  useEffect(() => {
    return window.doru.onCloseTab(() => {
      if (activeTabId) {
        closeTab(activeTabId);
      }
    });
  }, [activeTabId, closeTab]);

  const openPersonTab = useCallback(
    (personId: string) => {
      const person = persons.find((entry) => entry.id === personId);
      openTab({
        id: `${PERSON_TAB_PREFIX}${personId}`,
        label: person ? displayName(person) : personId,
      });
    },
    [persons, openTab],
  );

  const openNewPersonTab = useCallback(() => {
    openTab({
      id: `${PERSON_TAB_PREFIX}new:${crypto.randomUUID()}`,
      label: nls.t('features.tree.addPerson'),
    });
  }, [openTab]);

  const handleSelectView = useCallback(
    (view: ActivityViewId) => {
      setActiveView(view);
      if (view === 'tree' && projectPath) {
        openTab({ id: TREE_TAB_ID, label: nls.t('features.tree.title') });
      }
    },
    [openTab, projectPath],
  );

  const handleOpenSettings = useCallback(() => {
    openTab({ id: SETTINGS_TAB_ID, label: nls.t('workbench.settings') });
  }, [openTab]);

  const sidebar = (() => {
    switch (activeView) {
      case 'people':
        return <PersonList persons={persons} onOpen={openPersonTab} />;
      case 'places':
        return (
          <PlaceholderView
            title={nls.t('workbench.activityBar.places')}
            description={nls.t('features.places.placeholder')}
          />
        );
      case 'sources':
        return (
          <PlaceholderView
            title={nls.t('workbench.activityBar.sources')}
            description={nls.t('features.sources.placeholder')}
          />
        );
      case 'tasks':
        return (
          <PlaceholderView
            title={nls.t('workbench.activityBar.tasks')}
            description={nls.t('features.tasks.placeholder')}
          />
        );
      case 'search':
        return (
          <PlaceholderView
            title={nls.t('workbench.activityBar.search')}
            description={nls.t('features.search.placeholder')}
          />
        );
      case 'import':
        return (
          <PlaceholderView
            title={nls.t('workbench.activityBar.import')}
            description={projectPath ? undefined : nls.t('workbench.tree.empty')}
          >
            <button disabled={!projectPath} onClick={() => void importGedcom()}>
              {nls.t('features.tree.importGedcom')}
            </button>
          </PlaceholderView>
        );
      case 'export':
        return (
          <PlaceholderView
            title={nls.t('workbench.activityBar.export')}
            description={projectPath ? undefined : nls.t('workbench.tree.empty')}
          >
            <button disabled={!projectPath} onClick={() => void exportGedcom()}>
              {nls.t('features.tree.exportGedcom')}
            </button>
          </PlaceholderView>
        );
      default:
        return null;
    }
  })();

  const tabLabel = (tab: OpenTab): string => {
    if (tab.id.startsWith(PERSON_TAB_PREFIX)) {
      const personId = tab.id.slice(PERSON_TAB_PREFIX.length);
      if (personId.startsWith('new:')) {
        return nls.t('features.tree.addPerson');
      }
      const person = persons.find((entry) => entry.id === personId);
      if (person) {
        return displayName(person);
      }
    }
    return tab.label;
  };

  const tabInfos: TabInfo[] = openTabs.map((tab) => ({
    id: tab.id,
    label: tabLabel(tab),
    closable: tab.closable,
  }));

  const renderTabContent = (tab: OpenTab): ReactNode => {
    if (tab.id === TREE_TAB_ID) {
      return (
        <TreeView
          persons={persons}
          stats={stats}
          importResult={importResult}
          exportResult={exportResult}
          search={search}
          canUndo={undoState.canUndo}
          canRedo={undoState.canRedo}
          onSearch={onSearch}
          onUndo={() => void undo()}
          onRedo={() => void redo()}
          onImportGedcom={() => void importGedcom()}
          onExportGedcom={() => void exportGedcom()}
          onAddPerson={openNewPersonTab}
          onOpenPerson={openPersonTab}
          getGedcomText={getGedcomText}
        />
      );
    }
    if (tab.id === SETTINGS_TAB_ID) {
      return (
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
      );
    }
    if (tab.id.startsWith(PERSON_TAB_PREFIX)) {
      return (
        <PersonTab
          tabId={tab.id}
          persons={persons}
          onClose={closeTab}
          onAddPerson={addPerson}
          onUpdatePerson={updatePerson}
          getNotes={getNotes}
          onAddNote={addNote}
          getFamilies={getFamilies}
          onAddFamily={addFamily}
          onUpdateFamily={updateFamily}
          onDeleteFamily={deleteFamily}
          getSources={getSources}
          getCitations={getCitations}
          onAddSource={addSource}
          onAttachSource={attachSource}
          onDetachCitation={detachCitation}
          getEvents={getEvents}
          onAddEvent={addEvent}
          onDeleteEvent={deleteEvent}
          getMedia={getMedia}
          onAddMedia={addMedia}
          onDeleteMedia={deleteMedia}
        />
      );
    }
    return null;
  };

  const editor =
    projectPath === undefined ? null : openTabs.length === 0 ? (
      <WelcomePage
        recent={recent}
        onCreateProject={() => void createProject()}
        onOpenProject={() => void openProject()}
        onOpenRecent={(path) => void openProject(path)}
      />
    ) : (
      <div className="editor-stack">
        {openTabs.map((tab) => (
          <div
            key={tab.id}
            className={tab.id === activeTabId ? 'editor-pane active' : 'editor-pane'}
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
        sidebar={sidebar}
        activeView={activeView}
        onSelectView={handleSelectView}
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
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={closeTab}
        onOpenSettings={handleOpenSettings}
      />
    </>
  );
}

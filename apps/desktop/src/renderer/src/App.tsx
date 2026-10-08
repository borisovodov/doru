import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '@doru/ai';
import type {
  GedcomImportResult,
  NoteRecord,
  PersonRecord,
  ProjectSummary,
  RecentProject,
  TreeStats,
  UndoRedoState,
} from '@doru/core';
import { CommandService } from '@doru/platform';
import {
  ChatPanel,
  RecentList,
  TreeView,
  type ChatPermissionRequest,
  type ChatTranscriptMessage,
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
  const [chatMessages, setChatMessages] = useState<ChatTranscriptMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [permission, setPermission] = useState<ChatPermissionRequest | null>(null);
  const [themeCss, setThemeCss] = useState('');
  const commands = useMemo(() => new CommandService(), []);
  const chatConversation = useRef<ChatMessage[]>([]);

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

  const getGedcomText = useCallback(async (): Promise<string> => {
    if (!activePath) {
      return '';
    }
    return window.doru.getGedcomText(activePath);
  }, [activePath]);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

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

  return (
    <>
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
        editor={
          <TreeView
            summary={activeSummary}
            persons={activeSummary ? persons : []}
            stats={activeSummary ? stats : null}
            importResult={activeSummary ? importResult : null}
            exportResult={activeSummary ? exportResult : null}
            search={search}
            canUndo={undoState.canUndo}
            canRedo={undoState.canRedo}
            onOpenProject={() => void openProject()}
            onImportGedcom={() => void importGedcom()}
            onExportGedcom={() => void exportGedcom()}
            onSearch={onSearch}
            onUndo={() => void undo()}
            onRedo={() => void redo()}
            onAddPerson={(person) => void addPerson(person)}
            onUpdatePerson={(before, after) => void updatePerson(before, after)}
            getNotes={getNotes}
            onAddNote={(personId, text) => void addNote(personId, text)}
            getGedcomText={getGedcomText}
          />
        }
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
      />
    </>
  );
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

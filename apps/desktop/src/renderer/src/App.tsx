import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  GedcomImportResult,
  PersonRecord,
  ProjectSummary,
  RecentProject,
  TreeStats,
  UndoRedoState,
} from '@doru/core';
import { CommandService } from '@doru/platform';
import { RecentList, TreeView } from '@doru/features';
import { Workbench, nls, type TabInfo } from '@doru/workbench';

const NO_UNDO: UndoRedoState = { canUndo: false, canRedo: false };

export function App() {
  const [tabs, setTabs] = useState<ProjectSummary[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [persons, setPersons] = useState<PersonRecord[]>([]);
  const [stats, setStats] = useState<TreeStats | null>(null);
  const [undoState, setUndoState] = useState<UndoRedoState>(NO_UNDO);
  const [importResult, setImportResult] = useState<GedcomImportResult | null>(null);
  const [search, setSearch] = useState('');
  const commands = useMemo(() => new CommandService(), []);

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
      void reloadTree(activePath, '');
    } else {
      setPersons([]);
      setStats(null);
      setUndoState(NO_UNDO);
    }
  }, [activePath, reloadTree]);

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

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

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
          search={search}
          canUndo={undoState.canUndo}
          canRedo={undoState.canRedo}
          onOpenProject={() => void openProject()}
          onImportGedcom={() => void importGedcom()}
          onSearch={onSearch}
          onUndo={() => void undo()}
          onRedo={() => void redo()}
        />
      }
      tabs={tabInfos}
      activeTabId={activePath}
      onSelectTab={setActivePath}
      onCloseTab={(id) => void closeTab(id)}
      statusText={activeSummary ? activeSummary.path : nls.t('workbench.statusBar.ready')}
      onOpenProject={() => void openProject()}
    />
  );
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PersonRecord, TreeStats, UndoRedoState } from '@doru/core';
import type { PersonEditorApi } from '@doru/features';

const NO_UNDO: UndoRedoState = { canUndo: false, canRedo: false };

/**
 * Tree state and every mutation/reload that goes through `window.doru`.
 * Also builds the `PersonEditorApi` handed to the person editor.
 */
export function useTreeData(projectPath: string | null | undefined) {
  const [persons, setPersons] = useState<PersonRecord[]>([]);
  const [stats, setStats] = useState<TreeStats | null>(null);
  const [undoState, setUndoState] = useState<UndoRedoState>(NO_UNDO);
  const [search, setSearch] = useState('');

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
    void reloadTree(projectPath, '');
  }, [projectPath, reloadTree]);

  const refreshTree = useCallback(async () => {
    if (projectPath) {
      await reloadTree(projectPath, search);
    }
  }, [projectPath, search, reloadTree]);

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
    void refreshTree();
  }, [projectPath, refreshTree]);

  const redo = useCallback(async () => {
    if (!projectPath) {
      return;
    }
    setUndoState(await window.doru.redo(projectPath));
    void refreshTree();
  }, [projectPath, refreshTree]);

  const getGedcomText = useCallback(async (): Promise<string> => {
    if (!projectPath) {
      return '';
    }
    return window.doru.getGedcomText(projectPath);
  }, [projectPath]);

  const api = useMemo<PersonEditorApi>(
    () => ({
      addPerson: async (person) => {
        if (!projectPath) {
          return;
        }
        setUndoState(await window.doru.addPerson(projectPath, person));
        await refreshTree();
      },
      updatePerson: async (before, after) => {
        if (!projectPath) {
          return;
        }
        setUndoState(await window.doru.updatePerson(projectPath, before, after));
        await refreshTree();
      },
      getNotes: (personId) =>
        projectPath ? window.doru.listNotes(projectPath, personId) : Promise.resolve([]),
      addNote: async (personId, text) => {
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
      getFamilies: () =>
        projectPath ? window.doru.getFamilies(projectPath) : Promise.resolve([]),
      addFamily: async (family) => {
        if (!projectPath) {
          return;
        }
        setUndoState(await window.doru.addFamily(projectPath, family));
      },
      updateFamily: async (before, after) => {
        if (!projectPath) {
          return;
        }
        setUndoState(await window.doru.updateFamily(projectPath, before, after));
      },
      deleteFamily: async (family) => {
        if (!projectPath) {
          return;
        }
        setUndoState(await window.doru.deleteFamily(projectPath, family));
      },
      getSources: () =>
        projectPath ? window.doru.getSources(projectPath) : Promise.resolve([]),
      getCitations: (personId) =>
        projectPath ? window.doru.getCitations(projectPath, personId) : Promise.resolve([]),
      addSource: async (source, targetId) => {
        if (!projectPath) {
          return;
        }
        setUndoState(await window.doru.addSource(projectPath, source, 'person', targetId));
      },
      attachSource: async (sourceId, targetId) => {
        if (!projectPath) {
          return;
        }
        setUndoState(await window.doru.attachSource(projectPath, sourceId, 'person', targetId));
      },
      detachCitation: async (citationId) => {
        if (!projectPath) {
          return;
        }
        setUndoState(await window.doru.detachCitation(projectPath, citationId));
      },
      getEvents: (personId, familyId) =>
        projectPath ? window.doru.getEvents(projectPath, personId, familyId) : Promise.resolve([]),
      addEvent: async (event) => {
        if (!projectPath) {
          return;
        }
        setUndoState(await window.doru.addEvent(projectPath, event));
      },
      deleteEvent: async (event) => {
        if (!projectPath) {
          return;
        }
        setUndoState(await window.doru.deleteEvent(projectPath, event));
      },
      getMedia: (personId) =>
        projectPath ? window.doru.getMedia(projectPath, personId) : Promise.resolve([]),
      addMedia: async (personId) => {
        if (!projectPath) {
          return;
        }
        const added = await window.doru.addMedia(projectPath, personId);
        if (added.length > 0) {
          setUndoState(await window.doru.getUndoState(projectPath));
        }
      },
      deleteMedia: async (media) => {
        if (!projectPath) {
          return;
        }
        setUndoState(await window.doru.deleteMedia(projectPath, media));
      },
    }),
    [projectPath, refreshTree],
  );

  return {
    persons,
    stats,
    undoState,
    search,
    onSearch,
    undo,
    redo,
    refreshTree,
    getGedcomText,
    api,
  };
}

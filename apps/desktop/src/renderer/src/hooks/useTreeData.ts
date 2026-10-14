import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FamilyRecord, PersonRecord, UndoRedoState } from '@doru/core';
import type { PersonEditorApi } from '@doru/features';

const NO_UNDO: UndoRedoState = { canUndo: false, canRedo: false };

/**
 * Tree state and every mutation/reload that goes through `window.doru`.
 * Also builds the `PersonEditorApi` handed to the person editor.
 */
export function useTreeData(projectPath: string | null | undefined) {
  const [persons, setPersons] = useState<PersonRecord[]>([]);
  const [families, setFamilies] = useState<FamilyRecord[]>([]);
  const [undoState, setUndoState] = useState<UndoRedoState>(NO_UNDO);

  const reloadTree = useCallback(async (path: string) => {
    const [list, fams, undo] = await Promise.all([
      window.doru.listPersons(path),
      window.doru.getFamilies(path),
      window.doru.getUndoState(path),
    ]);
    setPersons(list);
    setFamilies(fams);
    setUndoState(undo);
  }, []);

  useEffect(() => {
    if (!projectPath) {
      setPersons([]);
      setFamilies([]);
      setUndoState(NO_UNDO);
      return;
    }
    void reloadTree(projectPath);
  }, [projectPath, reloadTree]);

  const refreshTree = useCallback(async () => {
    if (projectPath) {
      await reloadTree(projectPath);
    }
  }, [projectPath, reloadTree]);

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

  /**
   * Creates a person and links them to `anchorId`: as a child, as a spouse
   * (reusing the anchor's family or creating one), or as a parent (a new
   * family with the anchor as the child). A single compound op — one undo
   * removes the person and the link.
   */
  const addRelative = useCallback(
    async (relation: 'child' | 'spouse' | 'parent', anchorId: string, person: PersonRecord) => {
      if (!projectPath) {
        return;
      }
      setUndoState(await window.doru.addRelative(projectPath, relation, anchorId, person));
      await refreshTree();
    },
    [projectPath, refreshTree],
  );

  /**
   * Moves a person (as a child) into the family of `newParentId`, creating
   * that family when it does not exist. A single compound op — one undo
   * restores everything.
   */
  const reparent = useCallback(
    async (childId: string, newParentId: string) => {
      if (!projectPath || childId === newParentId) {
        return;
      }
      setUndoState(await window.doru.reparent(projectPath, childId, newParentId));
      await refreshTree();
    },
    [projectPath, refreshTree],
  );

  /**
   * Deletes the person record together with their family links (a single
   * compound op, so one undo restores everything).
   */
  const deletePerson = useCallback(
    async (person: PersonRecord) => {
      if (!projectPath) {
        return;
      }
      setUndoState(await window.doru.deletePerson(projectPath, person));
      await refreshTree();
    },
    [projectPath, refreshTree],
  );

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
    families,
    undoState,
    undo,
    redo,
    refreshTree,
    addRelative,
    deletePerson,
    reparent,
    api,
  };
}

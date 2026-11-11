import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CitationRecord,
  FactRecord,
  FamilyRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  SourceRecord,
} from '@doru/core';
import type { MediaWithPath, PersonEditorApi, PlaceEditorApi, SourceEditorApi } from '@doru/features';

/**
 * Tree state and every mutation/reload that goes through `window.doru`.
 * Also builds the `PersonEditorApi` handed to the person editor.
 */
export function useTreeData(projectPath: string | null | undefined) {
  const [persons, setPersons] = useState<PersonRecord[]>([]);
  const [families, setFamilies] = useState<FamilyRecord[]>([]);
  const [facts, setFacts] = useState<FactRecord[]>([]);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [media, setMedia] = useState<MediaWithPath[]>([]);
  const [citations, setCitations] = useState<CitationRecord[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [places, setPlaces] = useState<PlaceRecord[]>([]);

  const reloadTree = useCallback(async (path: string) => {
    const [data, allFacts, allSources, allMedia, allCitations, allNotes, allPlaces] = await Promise.all([
      window.doru.all(path),
      window.doru.getAllFacts(path),
      window.doru.getSources(path),
      window.doru.getAllMedia(path),
      window.doru.getAllCitations(path),
      window.doru.listNotes(path),
      window.doru.getPlaces(path),
    ]);
    setPersons(data.persons);
    setFamilies(data.families);
    setFacts(allFacts);
    setSources(allSources);
    setMedia(allMedia);
    setCitations(allCitations);
    setNotes(allNotes);
    setPlaces(allPlaces);
  }, []);

  useEffect(() => {
    if (!projectPath) {
      setPersons([]);
      setFamilies([]);
      setFacts([]);
      setSources([]);
      setMedia([]);
      setCitations([]);
      setNotes([]);
      return;
    }
    void reloadTree(projectPath);
  }, [projectPath, reloadTree]);

  // External writers (the in-app agent, ACP agents, MCP clients) mutate the
  // project file through their own connections; reload when the main process
  // reports a change so the tree stays in sync without manual reopening.
  useEffect(() => {
    if (!projectPath) {
      return;
    }
    return window.doru.onTreeExternalChange(() => {
      void reloadTree(projectPath);
    });
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
    await window.doru.undo(projectPath);
    void refreshTree();
  }, [projectPath, refreshTree]);

  const redo = useCallback(async () => {
    if (!projectPath) {
      return;
    }
    await window.doru.redo(projectPath);
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
      await window.doru.addRelative(projectPath, relation, anchorId, person);
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
      await window.doru.reparent(projectPath, childId, newParentId);
      await refreshTree();
    },
    [projectPath, refreshTree],
  );

  const personCounts = useCallback(
    (personIds: string[]) => {
      if (!projectPath || personIds.length === 0) {
        return Promise.resolve({} as Record<string, { notes: number; sources: number; media: number }>);
      }
      return window.doru.personCounts(projectPath, personIds);
    },
    [projectPath],
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
      await window.doru.deletePerson(projectPath, person);
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
        await window.doru.addPerson(projectPath, person);
        await refreshTree();
      },
      updatePerson: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updatePerson(projectPath, before, after);
        await refreshTree();
      },
      getNotes: (personId) =>
        projectPath ? window.doru.listNotes(projectPath, personId) : Promise.resolve([]),
      addNote: async (personId, text) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addNote(projectPath, {
          id: crypto.randomUUID(),
          text,
          targetType: 'person',
          targetId: personId,
        });
        await refreshTree();
      },
      getFamilies: () =>
        projectPath ? window.doru.getFamilies(projectPath) : Promise.resolve([]),
      addFamily: async (family) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addFamily(projectPath, family);
      },
      updateFamily: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateFamily(projectPath, before, after);
      },
      deleteFamily: async (family) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteFamily(projectPath, family);
      },
      getAssociations: (personId) =>
        projectPath ? window.doru.getAssociations(projectPath, personId) : Promise.resolve([]),
      addAssociation: async (association) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addAssociation(projectPath, association);
      },
      updateAssociation: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateAssociation(projectPath, before, after);
      },
      deleteAssociation: async (association) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteAssociation(projectPath, association);
      },
      getSources: () =>
        projectPath ? window.doru.getSources(projectPath) : Promise.resolve([]),
      getCitations: (personId) =>
        projectPath ? window.doru.getCitations(projectPath, personId) : Promise.resolve([]),
      addSource: async (source, targetId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addSource(projectPath, source, 'person', targetId);
        await refreshTree();
      },
      attachSource: async (sourceId, targetId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.attachSource(projectPath, sourceId, 'person', targetId);
        await refreshTree();
      },
      detachCitation: async (citationId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.detachCitation(projectPath, citationId);
        await refreshTree();
      },
      updateCitation: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateCitation(projectPath, before, after);
        await refreshTree();
      },
      getFacts: (personId, familyId) =>
        projectPath ? window.doru.getFacts(projectPath, personId, familyId) : Promise.resolve([]),
      addFact: async (fact) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addFact(projectPath, fact);
        await refreshTree();
      },
      updateFact: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateFact(projectPath, before, after);
        await refreshTree();
      },
      deleteFact: async (fact) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteFact(projectPath, fact);
        await refreshTree();
      },
      getMedia: (personId) =>
        projectPath ? window.doru.getMedia(projectPath, personId) : Promise.resolve([]),
      addMedia: async (personId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addMedia(projectPath, personId);
      },
      deleteMedia: async (media) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteMedia(projectPath, media);
      },
      getIdentifiers: (personId) =>
        projectPath ? window.doru.getIdentifiers(projectPath, personId) : Promise.resolve([]),
      addIdentifier: async (identifier) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addIdentifier(projectPath, identifier);
      },
      deleteIdentifier: async (identifier) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteIdentifier(projectPath, identifier);
      },
      getContacts: (personId) =>
        projectPath ? window.doru.getContacts(projectPath, personId) : Promise.resolve([]),
      addContact: async (contact) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addContact(projectPath, contact);
      },
      deleteContact: async (contact) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteContact(projectPath, contact);
      },
      getRestrictions: (personId) =>
        projectPath ? window.doru.getRestrictions(projectPath, personId) : Promise.resolve([]),
      addRestriction: async (restriction) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addRestriction(projectPath, restriction);
      },
      deleteRestriction: async (restriction) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteRestriction(projectPath, restriction);
      },
      getTags: () => (projectPath ? window.doru.getTags(projectPath) : Promise.resolve([])),
      getTagLinks: (personId) =>
        projectPath ? window.doru.getTagLinks(projectPath, personId) : Promise.resolve([]),
      addTag: async (tag) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addTag(projectPath, tag);
      },
      attachTag: async (link) => {
        if (!projectPath) {
          return;
        }
        await window.doru.attachTag(projectPath, link);
      },
      detachTag: async (link) => {
        if (!projectPath) {
          return;
        }
        await window.doru.detachTag(projectPath, link);
      },
      getChanges: (personId) =>
        projectPath ? window.doru.getChanges(projectPath, personId) : Promise.resolve([]),
      getPlaces: () => (projectPath ? window.doru.getPlaces(projectPath) : Promise.resolve([])),
    }),
    [projectPath, refreshTree],
  );

  const sourceApi = useMemo<SourceEditorApi>(
    () => ({
      getSources: () => (projectPath ? window.doru.getSources(projectPath) : Promise.resolve([])),
      updateSource: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateSource(projectPath, before, after);
        await refreshTree();
      },
      deleteSource: async (source) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteSource(projectPath, source);
        await refreshTree();
      },
      getRepositories: () =>
        projectPath ? window.doru.getRepositories(projectPath) : Promise.resolve([]),
      addRepository: async (repository) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addRepository(projectPath, repository);
        await refreshTree();
      },
    }),
    [projectPath, refreshTree],
  );

  const placeApi = useMemo<PlaceEditorApi>(
    () => ({
      getPlaces: () => (projectPath ? window.doru.getPlaces(projectPath) : Promise.resolve([])),
      updatePlace: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updatePlace(projectPath, before, after);
        await refreshTree();
      },
      deletePlace: async (place) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deletePlace(projectPath, place);
        await refreshTree();
      },
    }),
    [projectPath, refreshTree],
  );

  return {
    persons,
    families,
    facts,
    sources,
    media,
    citations,
    notes,
    places,
    undo,
    redo,
    refreshTree,
    addRelative,
    deletePerson,
    reparent,
    personCounts,
    api,
    sourceApi,
    placeApi,
  };
}

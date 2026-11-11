import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CitationRecord,
  FactRecord,
  FamilyRecord,
  ContactRecord,
  IdentifierRecord,
  NoteLinkRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  RestrictionRecord,
  SourceRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
  TitleRecord,
  TodoRecord,
} from '@doru/core';
import type { FamilyEditorApi, MediaWithPath, PersonEditorApi, PlaceEditorApi, RegistriesEditorApi, SourceEditorApi } from '@doru/features';

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
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [submitters, setSubmitters] = useState<SubmitterRecord[]>([]);
  const [todos, setTodos] = useState<TodoRecord[]>([]);
  const [titles, setTitles] = useState<TitleRecord[]>([]);

  const reloadTree = useCallback(async (path: string) => {
    const [data, allFacts, allSources, allMedia, allCitations, allNotes, allPlaces, allRepositories, allSubmitters, allTodos, allTitles] =
      await Promise.all([
        window.doru.all(path),
        window.doru.getAllFacts(path),
        window.doru.getSources(path),
        window.doru.getAllMedia(path),
        window.doru.getAllCitations(path),
        window.doru.listNotes(path),
        window.doru.getPlaces(path),
        window.doru.getRepositories(path),
        window.doru.getSubmitters(path),
        window.doru.getTodos(path),
        window.doru.getTitles(path),
      ]);
    setPersons(data.persons);
    setFamilies(data.families);
    setFacts(allFacts);
    setSources(allSources);
    setMedia(allMedia);
    setCitations(allCitations);
    setNotes(allNotes);
    setPlaces(allPlaces);
    setRepositories(allRepositories);
    setSubmitters(allSubmitters);
    setTodos(allTodos);
    setTitles(allTitles);
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
      setPlaces([]);
      setRepositories([]);
      setSubmitters([]);
      setTodos([]);
      setTitles([]);
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
        projectPath ? window.doru.listNotes(projectPath, 'person', personId) : Promise.resolve([]),
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
      updateNote: async (before, after, context) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateNote(projectPath, before, after, context);
        await refreshTree();
      },
      deleteNote: async (note) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteNote(projectPath, note);
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
        projectPath ? window.doru.getCitations(projectPath, 'person', personId) : Promise.resolve([]),
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
        projectPath ? window.doru.getIdentifiers(projectPath, 'person', personId) : Promise.resolve([]),
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
        projectPath ? window.doru.getContacts(projectPath, 'person', personId) : Promise.resolve([]),
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
        projectPath ? window.doru.getRestrictions(projectPath, 'person', personId) : Promise.resolve([]),
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
      getAliases: (personId) =>
        projectPath ? window.doru.getAliases(projectPath, personId) : Promise.resolve([]),
      addAlias: async (personId, aliasId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addAlias(projectPath, personId, aliasId);
        await refreshTree();
      },
      deleteAlias: async (id, personId, aliasId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteAlias(projectPath, id, personId, aliasId);
        await refreshTree();
      },
      getRecordSubmitters: (targetType, targetId) =>
        projectPath
          ? window.doru.getRecordSubmitters(projectPath, targetType, targetId)
          : Promise.resolve([]),
      addRecordSubmitter: async (submitterId, targetType, targetId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addRecordSubmitter(projectPath, submitterId, targetType, targetId);
        await refreshTree();
      },
      deleteRecordSubmitter: async (id, submitterId, targetType, targetId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteRecordSubmitter(projectPath, id, submitterId, targetType, targetId);
        await refreshTree();
      },
      getTagLinks: (personId) =>
        projectPath ? window.doru.getTagLinks(projectPath, 'person', personId) : Promise.resolve([]),
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
      updateTag: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateTag(projectPath, before, after);
      },
      deleteTag: async (tag) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteTag(projectPath, tag);
      },
      getChanges: (personId) =>
        projectPath ? window.doru.getChanges(projectPath, personId) : Promise.resolve([]),
      getPlaces: () => (projectPath ? window.doru.getPlaces(projectPath) : Promise.resolve([])),
      getSubmitters: () => (projectPath ? window.doru.getSubmitters(projectPath) : Promise.resolve([])),
    }),
    [projectPath, refreshTree],
  );

  /** The generic attachment CRUD shared by the family, source and place editors. */
  const attachmentMethods = useMemo(
    () => ({
      getNotes: (targetType: string, targetId: string) =>
        projectPath ? window.doru.listNotes(projectPath, targetType, targetId) : Promise.resolve([] as NoteRecord[]),
      addNote: async (note: NoteRecord) => {
        if (!projectPath) return;
        await window.doru.addNote(projectPath, note);
        await refreshTree();
      },
      updateNote: async (before: NoteRecord, after: NoteRecord, context?: NoteLinkRecord) => {
        if (!projectPath) return;
        await window.doru.updateNote(projectPath, before, after, context);
        await refreshTree();
      },
      deleteNote: async (note: NoteRecord) => {
        if (!projectPath) return;
        await window.doru.deleteNote(projectPath, note);
        await refreshTree();
      },
      getCitations: (targetType: string, targetId: string) =>
        projectPath ? window.doru.getCitations(projectPath, targetType, targetId) : Promise.resolve([] as CitationRecord[]),
      getSources: () => (projectPath ? window.doru.getSources(projectPath) : Promise.resolve([] as SourceRecord[])),
      addSource: async (source: SourceRecord, targetType?: string, targetId?: string) => {
        if (!projectPath) return;
        await window.doru.addSource(projectPath, source, targetType, targetId);
        await refreshTree();
      },
      attachSource: async (sourceId: string, targetType: string, targetId: string) => {
        if (!projectPath) return;
        await window.doru.attachSource(projectPath, sourceId, targetType, targetId);
        await refreshTree();
      },
      detachCitation: async (citationId: string) => {
        if (!projectPath) return;
        await window.doru.detachCitation(projectPath, citationId);
        await refreshTree();
      },
      updateCitation: async (before: CitationRecord, after: CitationRecord) => {
        if (!projectPath) return;
        await window.doru.updateCitation(projectPath, before, after);
        await refreshTree();
      },
      getIdentifiers: (targetType: string, targetId: string) =>
        projectPath ? window.doru.getIdentifiers(projectPath, targetType, targetId) : Promise.resolve([] as IdentifierRecord[]),
      addIdentifier: async (identifier: IdentifierRecord) => {
        if (!projectPath) return;
        await window.doru.addIdentifier(projectPath, identifier);
        await refreshTree();
      },
      deleteIdentifier: async (identifier: IdentifierRecord) => {
        if (!projectPath) return;
        await window.doru.deleteIdentifier(projectPath, identifier);
        await refreshTree();
      },
      getContacts: (targetType: string, targetId: string) =>
        projectPath ? window.doru.getContacts(projectPath, targetType, targetId) : Promise.resolve([] as ContactRecord[]),
      addContact: async (contact: ContactRecord) => {
        if (!projectPath) return;
        await window.doru.addContact(projectPath, contact);
        await refreshTree();
      },
      deleteContact: async (contact: ContactRecord) => {
        if (!projectPath) return;
        await window.doru.deleteContact(projectPath, contact);
        await refreshTree();
      },
      getRestrictions: (targetType: string, targetId: string) =>
        projectPath ? window.doru.getRestrictions(projectPath, targetType, targetId) : Promise.resolve([] as RestrictionRecord[]),
      addRestriction: async (restriction: RestrictionRecord) => {
        if (!projectPath) return;
        await window.doru.addRestriction(projectPath, restriction);
        await refreshTree();
      },
      deleteRestriction: async (restriction: RestrictionRecord) => {
        if (!projectPath) return;
        await window.doru.deleteRestriction(projectPath, restriction);
        await refreshTree();
      },
      getTags: () => (projectPath ? window.doru.getTags(projectPath) : Promise.resolve([] as TagRecord[])),
      getTagLinks: (targetType: string, targetId: string) =>
        projectPath ? window.doru.getTagLinks(projectPath, targetType, targetId) : Promise.resolve([] as Array<{ tagId: string; link: TagLinkRecord }>),
      addTag: async (tag: TagRecord) => {
        if (!projectPath) return;
        await window.doru.addTag(projectPath, tag);
        await refreshTree();
      },
      updateTag: async (before: TagRecord, after: TagRecord) => {
        if (!projectPath) return;
        await window.doru.updateTag(projectPath, before, after);
        await refreshTree();
      },
      deleteTag: async (tag: TagRecord) => {
        if (!projectPath) return;
        await window.doru.deleteTag(projectPath, tag);
        await refreshTree();
      },
      attachTag: async (link: TagLinkRecord) => {
        if (!projectPath) return;
        await window.doru.attachTag(projectPath, link);
        await refreshTree();
      },
      detachTag: async (link: TagLinkRecord) => {
        if (!projectPath) return;
        await window.doru.detachTag(projectPath, link);
        await refreshTree();
      },
    }),
    [projectPath, refreshTree],
  );

  const sourceApi = useMemo<SourceEditorApi>(
    () => ({
      ...attachmentMethods,
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
      getTitles: () => (projectPath ? window.doru.getTitles(projectPath) : Promise.resolve([])),
      getSubmitters: () => (projectPath ? window.doru.getSubmitters(projectPath) : Promise.resolve([] as SubmitterRecord[])),
      getRecordSubmitters: (targetType: string, targetId: string) =>
        projectPath
          ? window.doru.getRecordSubmitters(projectPath, targetType, targetId)
          : Promise.resolve([] as Array<{ id: string; submitterId: string; targetType: string; targetId: string }>),
      addRecordSubmitter: async (submitterId: string, targetType: string, targetId: string) => {
        if (!projectPath) return;
        await window.doru.addRecordSubmitter(projectPath, submitterId, targetType, targetId);
        await refreshTree();
      },
      deleteRecordSubmitter: async (id: string, submitterId: string, targetType: string, targetId: string) => {
        if (!projectPath) return;
        await window.doru.deleteRecordSubmitter(projectPath, id, submitterId, targetType, targetId);
        await refreshTree();
      },
    }),
    [projectPath, refreshTree, attachmentMethods],
  );

  const placeApi = useMemo<PlaceEditorApi>(
    () => ({
      ...attachmentMethods,
      getPlaces: () => (projectPath ? window.doru.getPlaces(projectPath) : Promise.resolve([])),
      addPlace: async (place) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addPlace(projectPath, place);
        await refreshTree();
      },
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
      getSubmitters: () => (projectPath ? window.doru.getSubmitters(projectPath) : Promise.resolve([] as SubmitterRecord[])),
      getRecordSubmitters: (targetType: string, targetId: string) =>
        projectPath
          ? window.doru.getRecordSubmitters(projectPath, targetType, targetId)
          : Promise.resolve([] as Array<{ id: string; submitterId: string; targetType: string; targetId: string }>),
      addRecordSubmitter: async (submitterId: string, targetType: string, targetId: string) => {
        if (!projectPath) return;
        await window.doru.addRecordSubmitter(projectPath, submitterId, targetType, targetId);
        await refreshTree();
      },
      deleteRecordSubmitter: async (id: string, submitterId: string, targetType: string, targetId: string) => {
        if (!projectPath) return;
        await window.doru.deleteRecordSubmitter(projectPath, id, submitterId, targetType, targetId);
        await refreshTree();
      },
    }),
    [projectPath, refreshTree, attachmentMethods],
  );

  const familyApi = useMemo<FamilyEditorApi>(
    () => ({
      ...attachmentMethods,
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
      getPlaces: () => (projectPath ? window.doru.getPlaces(projectPath) : Promise.resolve([])),
      updateFamily: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateFamily(projectPath, before, after);
        await refreshTree();
      },
      deleteFamily: async (family) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteFamily(projectPath, family);
        await refreshTree();
      },
      getSubmitters: () => (projectPath ? window.doru.getSubmitters(projectPath) : Promise.resolve([])),
      getRecordSubmitters: (targetType, targetId) =>
        projectPath
          ? window.doru.getRecordSubmitters(projectPath, targetType, targetId)
          : Promise.resolve([]),
      addRecordSubmitter: async (submitterId, targetType, targetId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addRecordSubmitter(projectPath, submitterId, targetType, targetId);
        await refreshTree();
      },
      deleteRecordSubmitter: async (id, submitterId, targetType, targetId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteRecordSubmitter(projectPath, id, submitterId, targetType, targetId);
        await refreshTree();
      },
    }),
    [projectPath, refreshTree, attachmentMethods],
  );

  const registriesApi = useMemo<RegistriesEditorApi>(
    () => ({
      getRepositories: () =>
        projectPath ? window.doru.getRepositories(projectPath) : Promise.resolve([]),
      addRepository: async (repository) => {
        if (!projectPath) return;
        await window.doru.addRepository(projectPath, repository);
        await refreshTree();
      },
      updateRepository: async (before, after) => {
        if (!projectPath) return;
        await window.doru.updateRepository(projectPath, before, after);
        await refreshTree();
      },
      deleteRepository: async (repository) => {
        if (!projectPath) return;
        await window.doru.deleteRepository(projectPath, repository);
        await refreshTree();
      },
      getSubmitters: () =>
        projectPath ? window.doru.getSubmitters(projectPath) : Promise.resolve([]),
      addSubmitter: async (submitter) => {
        if (!projectPath) return;
        await window.doru.addSubmitter(projectPath, submitter);
        await refreshTree();
      },
      updateSubmitter: async (before, after) => {
        if (!projectPath) return;
        await window.doru.updateSubmitter(projectPath, before, after);
        await refreshTree();
      },
      deleteSubmitter: async (submitter) => {
        if (!projectPath) return;
        await window.doru.deleteSubmitter(projectPath, submitter);
        await refreshTree();
      },
      addAddress: async (address) => {
        if (!projectPath) return;
        await window.doru.addAddress(projectPath, address);
      },
      updateAddress: async (before, after) => {
        if (!projectPath) return;
        await window.doru.updateAddress(projectPath, before, after);
      },
      deleteAddress: async (address) => {
        if (!projectPath) return;
        await window.doru.deleteAddress(projectPath, address);
      },
      getAddress: (id) =>
        projectPath ? window.doru.getAddress(projectPath, id) : Promise.resolve(undefined),
    }),
    [projectPath, refreshTree],
  );

  const titlesApi = useMemo(
    () => ({
      addTitle: async (title: TitleRecord) => {
        if (!projectPath) return;
        await window.doru.addTitle(projectPath, title);
        await refreshTree();
      },
      updateTitle: async (before: TitleRecord, after: TitleRecord) => {
        if (!projectPath) return;
        await window.doru.updateTitle(projectPath, before, after);
        await refreshTree();
      },
      deleteTitle: async (title: TitleRecord) => {
        if (!projectPath) return;
        await window.doru.deleteTitle(projectPath, title);
        await refreshTree();
      },
    }),
    [projectPath, refreshTree],
  );

  const todosApi = useMemo(
    () => ({
      addTodo: async (todo: TodoRecord) => {
        if (!projectPath) return;
        await window.doru.addTodo(projectPath, todo);
        await refreshTree();
      },
      updateTodo: async (before: TodoRecord, after: TodoRecord) => {
        if (!projectPath) return;
        await window.doru.updateTodo(projectPath, before, after);
        await refreshTree();
      },
      deleteTodo: async (todo: TodoRecord) => {
        if (!projectPath) return;
        await window.doru.deleteTodo(projectPath, todo);
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
    repositories,
    submitters,
    todos,
    titles,
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
    familyApi,
    registriesApi,
    todosApi,
    titlesApi,
  };
}

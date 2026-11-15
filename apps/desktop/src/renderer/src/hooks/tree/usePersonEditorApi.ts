import { useMemo } from 'react';
import type { TodoRecord } from '@doru/core';
import type { MediaTargetApi, PersonEditorApi } from '@doru/features';
import type { RefreshTree } from './types';

export function usePersonEditorApi(
  projectPath: string | null | undefined,
  refreshTree: RefreshTree,
  mediaApi: MediaTargetApi,
): PersonEditorApi {
  const api = useMemo<PersonEditorApi>(
    () => ({
      ...mediaApi,
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
      getNotes: (targetType, targetId) =>
        projectPath ? window.doru.listNotes(projectPath, targetType, targetId) : Promise.resolve([]),
      getAllNotes: () => (projectPath ? window.doru.listNotes(projectPath) : Promise.resolve([])),
      addNote: async (note) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addNote(projectPath, note);
        await refreshTree();
      },
      updateNote: async (before, after, context) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateNote(projectPath, before, after, context);
        await refreshTree();
      },
      attachNote: async (noteId, link) => {
        if (!projectPath) {
          return;
        }
        await window.doru.attachNote(projectPath, noteId, link);
        await refreshTree();
      },
      detachNote: async (note, link) => {
        if (!projectPath) {
          return;
        }
        await window.doru.detachNote(projectPath, note, link);
        await refreshTree();
      },
      deleteNote: async (note) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteNote(projectPath, note);
        await refreshTree();
      },
      getTodosFor: (targetType, targetId) =>
        projectPath ? window.doru.getTodosFor(projectPath, targetType, targetId) : Promise.resolve([] as TodoRecord[]),
      addTodo: async (todo) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addTodo(projectPath, todo);
        await refreshTree();
      },
      updateTodo: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateTodo(projectPath, before, after);
        await refreshTree();
      },
      deleteTodo: async (todo) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteTodo(projectPath, todo);
        await refreshTree();
      },
      getFamilies: () => (projectPath ? window.doru.getFamilies(projectPath) : Promise.resolve([])),
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
      getSources: () => (projectPath ? window.doru.getSources(projectPath) : Promise.resolve([])),
      getCitations: (targetType, targetId) =>
        projectPath ? window.doru.getCitations(projectPath, targetType, targetId) : Promise.resolve([]),
      addSource: async (source, targetType, targetId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addSource(projectPath, source, targetType, targetId);
        await refreshTree();
      },
      attachSource: async (sourceId, targetType, targetId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.attachSource(projectPath, sourceId, targetType, targetId);
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
        projectPath ? window.doru.getMedia(projectPath, 'person', personId) : Promise.resolve([]),
      addMedia: async (personId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addMedia(projectPath, 'person', personId);
      },
      deleteMedia: async (media) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteMedia(projectPath, media);
      },
      getIdentifiers: (targetType, targetId) =>
        projectPath ? window.doru.getIdentifiers(projectPath, targetType, targetId) : Promise.resolve([]),
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
      updateIdentifier: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateIdentifier(projectPath, before, after);
      },
      getContacts: (targetType, targetId) =>
        projectPath ? window.doru.getContacts(projectPath, targetType, targetId) : Promise.resolve([]),
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
      updateContact: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateContact(projectPath, before, after);
      },
      getRestrictions: (targetType, targetId) =>
        projectPath ? window.doru.getRestrictions(projectPath, targetType, targetId) : Promise.resolve([]),
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
      updateRestriction: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateRestriction(projectPath, before, after);
      },
      getTags: () => (projectPath ? window.doru.getTags(projectPath) : Promise.resolve([])),
      getAliases: (personId) => (projectPath ? window.doru.getAliases(projectPath, personId) : Promise.resolve([])),
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
        projectPath ? window.doru.getRecordSubmitters(projectPath, targetType, targetId) : Promise.resolve([]),
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
      getTagLinks: (targetType, targetId) =>
        projectPath ? window.doru.getTagLinks(projectPath, targetType, targetId) : Promise.resolve([]),
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
      updateTagLink: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateTagLink(projectPath, before, after);
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
      getChanges: (targetType, targetId) =>
        projectPath ? window.doru.getChanges(projectPath, targetType, targetId) : Promise.resolve([]),
      getPlaces: () => (projectPath ? window.doru.getPlaces(projectPath) : Promise.resolve([])),
      getAddresses: () => (projectPath ? window.doru.listAddresses(projectPath) : Promise.resolve([])),
      addAddress: async (address) => {
        if (projectPath) {
          await window.doru.addAddress(projectPath, address);
          await refreshTree();
        }
        return address;
      },
      updateAddress: async (before, after) => {
        if (projectPath) {
          await window.doru.updateAddress(projectPath, before, after);
          await refreshTree();
        }
        return after;
      },
      getSubmitters: () => (projectPath ? window.doru.getSubmitters(projectPath) : Promise.resolve([])),
    }),
    [projectPath, refreshTree, mediaApi],
  );

  return api;
}

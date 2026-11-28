import { useMemo } from 'react';
import type { SubmitterLink, TargetRef, TaskRecord, TaskTargetLink } from '@doru/core';
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
        await refreshTree().catch(() => undefined);
      },
      updatePerson: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updatePerson(projectPath, before, after);
        // The write already committed; a failed snapshot reload must not keep
        // the submitted edits marked as pending.
        await refreshTree().catch(() => undefined);
      },
      getNotes: (targetType, targetId) =>
        projectPath ? window.doru.listNotes(projectPath, targetType, targetId) : Promise.resolve([]),
      addNote: async (note) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addNote(projectPath, note);
        await refreshTree().catch(() => undefined);
      },
      updateNote: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateNote(projectPath, before, after);
        await refreshTree().catch(() => undefined);
      },
      deleteNote: async (note) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteNote(projectPath, note);
        await refreshTree().catch(() => undefined);
      },
      getTasksFor: (targetType, targetId) =>
        projectPath ? window.doru.getTasksFor(projectPath, targetType, targetId) : Promise.resolve([] as TaskRecord[]),
      getAllTasks: () => (projectPath ? window.doru.getTasks(projectPath) : Promise.resolve([] as TaskRecord[])),
      addTask: async (task) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addTask(projectPath, task);
        await refreshTree().catch(() => undefined);
      },
      updateTask: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateTask(projectPath, before, after);
        await refreshTree().catch(() => undefined);
      },
      deleteTask: async (task) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteTask(projectPath, task);
        await refreshTree().catch(() => undefined);
      },
      addTaskLink: async (link: TaskTargetLink) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addTaskLink(projectPath, link);
        await refreshTree().catch(() => undefined);
      },
      deleteTaskLink: async (link: TaskTargetLink) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteTaskLink(projectPath, link);
        await refreshTree().catch(() => undefined);
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
        await refreshTree().catch(() => undefined);
      },
      attachSource: async (sourceId, targetType, targetId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.attachSource(projectPath, sourceId, targetType, targetId);
        await refreshTree().catch(() => undefined);
      },
      attachSourceToTargets: async (sourceId: string, targets: TargetRef[]) => {
        if (!projectPath) {
          return;
        }
        await window.doru.attachSourceToTargets(projectPath, sourceId, targets);
        await refreshTree().catch(() => undefined);
      },
      detachCitation: async (citationId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.detachCitation(projectPath, citationId);
        await refreshTree().catch(() => undefined);
      },
      updateCitation: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateCitation(projectPath, before, after);
        await refreshTree().catch(() => undefined);
      },
      getFacts: (personId, familyId) =>
        projectPath ? window.doru.getFacts(projectPath, personId, familyId) : Promise.resolve([]),
      addFact: async (fact) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addFact(projectPath, fact);
        await refreshTree().catch(() => undefined);
      },
      updateFact: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateFact(projectPath, before, after);
        await refreshTree().catch(() => undefined);
      },
      deleteFact: async (fact) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteFact(projectPath, fact);
        await refreshTree().catch(() => undefined);
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
      getAliases: (personId) => (projectPath ? window.doru.getAliases(projectPath, personId) : Promise.resolve([])),
      addAlias: async (personId, aliasId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addAlias(projectPath, personId, aliasId);
        await refreshTree().catch(() => undefined);
      },
      deleteAlias: async (id, personId, aliasId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteAlias(projectPath, id, personId, aliasId);
        await refreshTree().catch(() => undefined);
      },
      getSubmitterLinks: (targetType, targetId): Promise<SubmitterLink[]> =>
        projectPath ? window.doru.getSubmitterLinks(projectPath, targetType, targetId) : Promise.resolve([]),
      addSubmitterLink: async (
        submitterId,
        targetType,
        targetId,
        kind: NonNullable<SubmitterLink['kind']> = 'contributor',
      ) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addSubmitterLink(projectPath, submitterId, targetType, targetId, kind);
        await refreshTree().catch(() => undefined);
      },
      deleteSubmitterLink: async (
        id,
        submitterId,
        targetType,
        targetId,
        kind: NonNullable<SubmitterLink['kind']> = 'contributor',
      ) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteSubmitterLink(projectPath, id, submitterId, targetType, targetId, kind);
        await refreshTree().catch(() => undefined);
      },
      getPlaces: () => (projectPath ? window.doru.getPlaces(projectPath) : Promise.resolve([])),
      getAddresses: () => (projectPath ? window.doru.listAddresses(projectPath) : Promise.resolve([])),
      addAddress: async (address) => {
        if (projectPath) {
          await window.doru.addAddress(projectPath, address);
          await refreshTree().catch(() => undefined);
        }
        return address;
      },
      updateAddress: async (before, after) => {
        if (projectPath) {
          await window.doru.updateAddress(projectPath, before, after);
          await refreshTree().catch(() => undefined);
        }
        return after;
      },
      getSubmitters: () => (projectPath ? window.doru.getSubmitters(projectPath) : Promise.resolve([])),
    }),
    [projectPath, refreshTree, mediaApi],
  );

  return api;
}

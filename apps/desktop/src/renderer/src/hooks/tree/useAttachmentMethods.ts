import { useMemo } from 'react';
import type {
  CitationRecord,
  ChangeRecord,
  ContactRecord,
  IdentifierRecord,
  NoteLinkRecord,
  NoteRecord,
  RestrictionRecord,
  SourceRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
  TodoRecord,
} from '@doru/core';
import type { MediaTargetApi } from '@doru/features';
import type { RefreshTree } from './types';

export function useAttachmentMethods(
  projectPath: string | null | undefined,
  refreshTree: RefreshTree,
  mediaApi: MediaTargetApi,
) {
  const attachmentMethods = useMemo(
    () => ({
      ...mediaApi,
      getNotes: (targetType: string, targetId: string) =>
        projectPath ? window.doru.listNotes(projectPath, targetType, targetId) : Promise.resolve([] as NoteRecord[]),
      getAllNotes: () => (projectPath ? window.doru.listNotes(projectPath) : Promise.resolve([] as NoteRecord[])),
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
      attachNote: async (noteId: string, link: NoteLinkRecord) => {
        if (!projectPath) return;
        await window.doru.attachNote(projectPath, noteId, link);
        await refreshTree();
      },
      detachNote: async (note: NoteRecord, link: NoteLinkRecord) => {
        if (!projectPath) return;
        await window.doru.detachNote(projectPath, note, link);
        await refreshTree();
      },
      deleteNote: async (note: NoteRecord) => {
        if (!projectPath) return;
        await window.doru.deleteNote(projectPath, note);
        await refreshTree();
      },
      getTodosFor: (targetType: string, targetId: string) =>
        projectPath ? window.doru.getTodosFor(projectPath, targetType, targetId) : Promise.resolve([] as TodoRecord[]),
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
      getCitations: (targetType: string, targetId: string) =>
        projectPath
          ? window.doru.getCitations(projectPath, targetType, targetId)
          : Promise.resolve([] as CitationRecord[]),
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
        projectPath
          ? window.doru.getIdentifiers(projectPath, targetType, targetId)
          : Promise.resolve([] as IdentifierRecord[]),
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
      updateIdentifier: async (before: IdentifierRecord, after: IdentifierRecord) => {
        if (!projectPath) return;
        await window.doru.updateIdentifier(projectPath, before, after);
        await refreshTree();
      },
      getContacts: (targetType: string, targetId: string) =>
        projectPath
          ? window.doru.getContacts(projectPath, targetType, targetId)
          : Promise.resolve([] as ContactRecord[]),
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
      updateContact: async (before: ContactRecord, after: ContactRecord) => {
        if (!projectPath) return;
        await window.doru.updateContact(projectPath, before, after);
        await refreshTree();
      },
      getRestrictions: (targetType: string, targetId: string) =>
        projectPath
          ? window.doru.getRestrictions(projectPath, targetType, targetId)
          : Promise.resolve([] as RestrictionRecord[]),
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
      updateRestriction: async (before: RestrictionRecord, after: RestrictionRecord) => {
        if (!projectPath) return;
        await window.doru.updateRestriction(projectPath, before, after);
        await refreshTree();
      },
      getTags: () => (projectPath ? window.doru.getTags(projectPath) : Promise.resolve([] as TagRecord[])),
      getTagLinks: (targetType: string, targetId: string) =>
        projectPath
          ? window.doru.getTagLinks(projectPath, targetType, targetId)
          : Promise.resolve([] as Array<{ tagId: string; link: TagLinkRecord }>),
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
      updateTagLink: async (before: TagLinkRecord, after: TagLinkRecord) => {
        if (!projectPath) return;
        await window.doru.updateTagLink(projectPath, before, after);
        await refreshTree();
      },
      getChanges: (targetType: string, targetId: string) =>
        projectPath ? window.doru.getChanges(projectPath, targetType, targetId) : Promise.resolve([] as ChangeRecord[]),
      getSubmitters: () =>
        projectPath ? window.doru.getSubmitters(projectPath) : Promise.resolve([] as SubmitterRecord[]),
      getRecordSubmitters: (targetType: string, targetId: string) =>
        projectPath
          ? window.doru.getRecordSubmitters(projectPath, targetType, targetId)
          : Promise.resolve([] as Array<{ id: string; submitterId: string; targetType: string; targetId: string }>),
      addRecordSubmitter: async (
        submitterId: string,
        targetType: string,
        targetId: string,
        kind: 'contributor' | 'ancestor_interest' | 'descendant_interest' = 'contributor',
      ) => {
        if (!projectPath) return;
        await window.doru.addRecordSubmitter(projectPath, submitterId, targetType, targetId, kind);
        await refreshTree();
      },
      deleteRecordSubmitter: async (
        id: string,
        submitterId: string,
        targetType: string,
        targetId: string,
        kind: 'contributor' | 'ancestor_interest' | 'descendant_interest' = 'contributor',
      ) => {
        if (!projectPath) return;
        await window.doru.deleteRecordSubmitter(projectPath, id, submitterId, targetType, targetId, kind);
        await refreshTree();
      },
    }),
    [projectPath, refreshTree, mediaApi],
  );
  return attachmentMethods;
}

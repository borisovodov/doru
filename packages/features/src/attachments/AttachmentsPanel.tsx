import type { ReactNode } from 'react';
import type { CitationRecord, SourceRecord, SubmitterRecord } from '@doru/core';
import {
  ChangesSection,
  ContactsSection,
  ContributorsSection,
  IdentifiersSection,
  NotesSection,
  RestrictionsSection,
  SourcesSection,
  TagsSection,
} from '@doru/ui/domain';
import type { AttachmentsApi } from '../person/types';
import { useAttachments } from './useAttachments';

export type AttachmentSection =
  | 'notes'
  | 'sources'
  | 'tags'
  | 'identifiers'
  | 'contacts'
  | 'restrictions'
  | 'contributors'
  | 'changes';

export interface AttachmentsPanelApi extends AttachmentsApi {
  getSubmitters(): Promise<SubmitterRecord[]>;
  getRecordSubmitters(
    targetType: string,
    targetId: string,
  ): Promise<Array<{ id: string; submitterId: string; targetType: string; targetId: string }>>;
  addRecordSubmitter(submitterId: string, targetType: string, targetId: string): Promise<void>;
  deleteRecordSubmitter(id: string, submitterId: string, targetType: string, targetId: string): Promise<void>;
}

const ALL_SECTIONS: readonly AttachmentSection[] = [
  'notes',
  'sources',
  'tags',
  'identifiers',
  'contacts',
  'restrictions',
  'contributors',
  'changes',
];

/**
 * The universal attachment surface of one target. Fact, name, citation and
 * note editors use it with a restricted `sections` list to avoid recursive
 * panels; entity tabs reuse it with the full default set.
 */
export function AttachmentsPanel({
  targetType,
  targetId,
  api,
  sources,
  sections = ALL_SECTIONS,
  onOpenSource,
  renderCitationAttachments,
}: {
  targetType: string;
  targetId: string | undefined;
  api: AttachmentsPanelApi;
  sources: SourceRecord[];
  sections?: readonly AttachmentSection[];
  onOpenSource?: ((sourceId: string) => void) | undefined;
  renderCitationAttachments?: ((citation: CitationRecord) => ReactNode) | undefined;
}) {
  const {
    notes,
    allNotes,
    citations,
    tags,
    tagLinks,
    identifiers,
    contacts,
    restrictions,
    changes,
    submitters,
    contributors,
    refresh,
  } = useAttachments(targetType, targetId, api, true);

  if (targetId === undefined) {
    return null;
  }

  const include = new Set(sections);
  return (
    <>
      {include.has('notes') && (
        <NotesSection
          targetType={targetType}
          targetId={targetId}
          notes={notes}
          availableNotes={allNotes}
          onAdd={async (text) => {
            await api.addNote({
              id: crypto.randomUUID(),
              text,
              targetType,
              targetId,
              links: [{ id: crypto.randomUUID(), targetType, targetId }],
            });
            await refresh();
          }}
          onUpdate={async (before, after, context, mode) => {
            if (mode === 'shared') {
              await api.updateNote(before, after);
            } else {
              await api.updateNote(before, after, context);
            }
            await refresh();
          }}
          onAttach={async (noteId) => {
            await api.attachNote(noteId, { id: crypto.randomUUID(), targetType, targetId });
            await refresh();
          }}
          onDetach={async (note, link) => {
            await api.detachNote(note, link);
            await refresh();
          }}
          onDelete={async (note) => {
            await api.deleteNote(note);
            await refresh();
          }}
        />
      )}
      {include.has('sources') && (
        <SourcesSection
          targetType={targetType}
          targetId={targetId}
          sources={sources}
          citations={citations}
          refresh={refresh}
          onAddSource={api.addSource}
          onAttachSource={api.attachSource}
          onDetachCitation={api.detachCitation}
          onUpdateCitation={api.updateCitation}
          onOpenSource={onOpenSource ?? (() => undefined)}
          renderCitationAttachments={renderCitationAttachments}
        />
      )}
      {include.has('tags') && (
        <TagsSection
          targetType={targetType}
          targetId={targetId}
          tags={tags}
          tagLinks={tagLinks}
          onAddTag={api.addTag}
          onUpdateTag={async (before, after) => {
            await api.updateTag(before, after);
            await refresh();
          }}
          onDeleteTag={async (tag) => {
            await api.deleteTag(tag);
            await refresh();
          }}
          onAttachTag={async (link) => {
            await api.attachTag(link);
            await refresh();
          }}
          onDetachTag={async (link) => {
            await api.detachTag(link);
            await refresh();
          }}
          onUpdateTagLink={async (before, after) => {
            await api.updateTagLink(before, after);
            await refresh();
          }}
        />
      )}
      {include.has('identifiers') && (
        <IdentifiersSection
          targetType={targetType}
          targetId={targetId}
          identifiers={identifiers}
          onAdd={async (identifier) => {
            await api.addIdentifier(identifier);
            await refresh();
          }}
          onUpdate={async (before, after) => {
            await api.updateIdentifier(before, after);
            await refresh();
          }}
          onDelete={async (identifier) => {
            await api.deleteIdentifier(identifier);
            await refresh();
          }}
        />
      )}
      {include.has('contacts') && (
        <ContactsSection
          targetType={targetType}
          targetId={targetId}
          contacts={contacts}
          onAdd={async (contact) => {
            await api.addContact(contact);
            await refresh();
          }}
          onUpdate={async (before, after) => {
            await api.updateContact(before, after);
            await refresh();
          }}
          onDelete={async (contact) => {
            await api.deleteContact(contact);
            await refresh();
          }}
        />
      )}
      {include.has('restrictions') && (
        <RestrictionsSection
          targetType={targetType}
          targetId={targetId}
          restrictions={restrictions}
          onAdd={async (restriction) => {
            await api.addRestriction(restriction);
            await refresh();
          }}
          onUpdate={async (before, after) => {
            await api.updateRestriction(before, after);
            await refresh();
          }}
          onDelete={async (restriction) => {
            await api.deleteRestriction(restriction);
            await refresh();
          }}
        />
      )}
      {include.has('contributors') && (
        <ContributorsSection
          targetType={targetType}
          targetId={targetId}
          submitters={submitters}
          links={contributors}
          onAdd={async (submitterId, type, id) => {
            await api.addRecordSubmitter(submitterId, type, id);
            await refresh();
          }}
          onDelete={async (id, submitterId, type, target) => {
            await api.deleteRecordSubmitter(id, submitterId, type, target);
            await refresh();
          }}
        />
      )}
      {include.has('changes') && <ChangesSection changes={changes} />}
    </>
  );
}

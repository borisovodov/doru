import { useEffect, useState, type ReactNode } from 'react';
import type { CitationRecord, SourceRecord } from '@doru/core';
import { isContactTargetType } from '@doru/core/model';
import { MEDIA_VISIBLE } from '@doru/platform';
import {
  ContactsSection,
  ContributorsSection,
  IdentifiersSection,
  NotesSection,
  SourcesSection,
  TasksSection,
  type MediaWithPath,
} from '@doru/ui/domain';
import { MediaSection } from '../media/MediaSection';
import type { AttachmentsApi } from '../person/types';
import { useAttachments, type ContributorApi } from './useAttachments';

export type AttachmentSection = 'notes' | 'sources' | 'media' | 'identifiers' | 'contacts' | 'contributors' | 'tasks';

export type AttachmentsPanelApi = AttachmentsApi & ContributorApi;

const ALL_SECTIONS: readonly AttachmentSection[] = [
  'notes',
  'sources',
  'media',
  'identifiers',
  'contacts',
  'contributors',
  'tasks',
];

/**
 * The universal attachment surface of one target. Fact, name and citation
 * editors use it with a restricted `sections` list to avoid recursive panels;
 * entity tabs reuse it with the full default set.
 */
export function AttachmentsPanel({
  targetType,
  targetId,
  api,
  sources,
  sections = ALL_SECTIONS,
  onOpenSource,
  onOpenMedia,
  renderCitationAttachments,
}: {
  targetType: string;
  targetId: string | undefined;
  api: AttachmentsPanelApi;
  sources: SourceRecord[];
  sections?: readonly AttachmentSection[];
  onOpenSource?: ((sourceId: string) => void) | undefined;
  onOpenMedia?: ((mediaId: string) => void) | undefined;
  renderCitationAttachments?: ((citation: CitationRecord) => ReactNode) | undefined;
}) {
  const { notes, allNotes, citations, identifiers, contacts, submitters, contributors, refresh } = useAttachments(
    targetType,
    targetId,
    api,
    true,
  );

  if (targetId === undefined) {
    return null;
  }

  // A task is a work item, not an assertion about the tree: a source cited on
  // it would be evidence for nothing. Hide the sources section regardless of
  // the caller's list, matching the service-level rejection in @doru/core.
  // Contacts likewise exist only on targets GEDCOM can carry them for; other
  // targets have no import or export path.
  const availableSections = sections.filter((section) => {
    if (section === 'sources' && targetType === 'task') {
      return false;
    }
    if (section === 'contacts' && !isContactTargetType(targetType)) {
      return false;
    }
    return true;
  });
  const include = new Set(
    MEDIA_VISIBLE ? availableSections : availableSections.filter((section) => section !== 'media'),
  );
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
      {include.has('media') && (
        <MediaAttachments targetType={targetType} targetId={targetId} api={api} onOpenMedia={onOpenMedia} />
      )}
      {include.has('identifiers') && (
        <IdentifiersSection
          targetType={targetType}
          targetId={targetId}
          identifiers={identifiers}
          canAdd={targetType !== 'task'}
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
      {include.has('contributors') && (
        <ContributorsSection
          targetType={targetType}
          targetId={targetId}
          submitters={submitters}
          links={contributors}
          canAdd={targetType !== 'task'}
          onAdd={async (submitterId, type, id, kind) => {
            await api.addRecordSubmitter(submitterId, type, id, kind);
            await refresh();
          }}
          onDelete={async (id, submitterId, type, target, kind) => {
            await api.deleteRecordSubmitter(id, submitterId, type, target, kind);
            await refresh();
          }}
        />
      )}
      {include.has('tasks') && <TasksSection targetType={targetType} targetId={targetId} api={api} />}
    </>
  );
}

function MediaAttachments({
  targetType,
  targetId,
  api,
  onOpenMedia,
}: {
  targetType: string;
  targetId: string | undefined;
  api: AttachmentsPanelApi;
  onOpenMedia?: ((mediaId: string) => void) | undefined;
}) {
  const [media, setMedia] = useState<MediaWithPath[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (targetId === undefined) {
      return;
    }
    void api.getMediaFor(targetType, targetId).then((loaded) => {
      if (!cancelled) {
        setMedia(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api, targetId, targetType]);

  if (targetId === undefined) {
    return null;
  }

  return (
    <MediaSection
      targetType={targetType}
      targetId={targetId}
      media={media}
      api={api}
      refresh={async () => setMedia(await api.getMediaFor(targetType, targetId))}
      onOpenMedia={onOpenMedia}
    />
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import type { CitationRecord, SourceRecord } from '@doru/core';
import { isAttachmentTargetAllowed, type AttachmentTargetKind } from '@doru/core/model';
import {
  ContactsSection,
  ContributorsSection,
  NotesSection,
  SourcesSection,
  TasksSection,
  type MediaWithPath,
} from '@doru/ui/domain';
import { MediaSection } from '../media/MediaSection';
import type { AttachmentsApi } from '../person/types';
import { useAttachments, type ContributorApi } from './useAttachments';

export type AttachmentSection = 'notes' | 'sources' | 'media' | 'contacts' | 'contributors' | 'tasks';

export type AttachmentsPanelApi = AttachmentsApi & ContributorApi;

const ALL_SECTIONS: readonly AttachmentSection[] = ['notes', 'sources', 'media', 'contacts', 'contributors', 'tasks'];

/** The attachment family that governs each panel section. */
const SECTION_TARGET_KIND: Readonly<Record<AttachmentSection, AttachmentTargetKind>> = {
  notes: 'note',
  sources: 'citation',
  media: 'mediaLink',
  contacts: 'contact',
  contributors: 'submitterLink',
  tasks: 'taskLink',
};

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
  const { notes, citations, contacts, submitters, contributors, refresh } = useAttachments(
    targetType,
    targetId,
    api,
    true,
  );

  if (targetId === undefined) {
    return null;
  }

  // Every section is filtered through the core target policy, so a target
  // that the link family cannot point at never shows an empty or unusable
  // section. The explicit `sections` list only narrows the caller's request.
  const availableSections = sections.filter((section) =>
    isAttachmentTargetAllowed(SECTION_TARGET_KIND[section], targetType),
  );
  const include = new Set(availableSections);
  const canAddContributor = isAttachmentTargetAllowed('submitterLink', targetType);
  const canAddTask = isAttachmentTargetAllowed('taskLink', targetType);
  return (
    <>
      {include.has('notes') && (
        <NotesSection
          notes={notes}
          onAdd={async (text) => {
            await api.addNote({
              id: crypto.randomUUID(),
              text,
              targetType,
              targetId,
            });
            await refresh();
          }}
          onUpdate={async (before, after) => {
            await api.updateNote(before, after);
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
          canAdd={canAddContributor}
          onAdd={async (submitterId, type, id, kind) => {
            await api.addSubmitterLink(submitterId, type, id, kind);
            await refresh();
          }}
          onDelete={async (id, submitterId, type, target, kind) => {
            await api.deleteSubmitterLink(id, submitterId, type, target, kind);
            await refresh();
          }}
        />
      )}
      {include.has('tasks') && (
        <TasksSection targetType={targetType} targetId={targetId} api={api} canAdd={canAddTask} />
      )}
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

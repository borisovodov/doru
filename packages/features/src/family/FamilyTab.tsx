import { useEffect, useMemo, useRef, useState } from 'react';
import type { AssociationRecord, FamilyRecord, PersonRecord, SourceRecord } from '@doru/core';
import { AttachmentsPanel, CitationAttachments, NoteAttachments, useAttachments } from '../attachments';
import { EntityTab } from '../sidebar';
import type { FamilyEditorApi, MediaTargetApi } from '../person/types';
import { FamilyEditor } from './FamilyEditor';
import type { MediaWithPath } from '@doru/ui/domain';
import {
  ContactsSection,
  ContributorsSection,
  IdentifiersSection,
  NotesSection,
  RestrictionsSection,
  SourcesSection,
  TagsSection,
  MediaSection,
  TasksSection,
  familyDraftMatches,
  familyDraftToRecord,
  familyToDraft,
  type FamilyDraft,
} from '@doru/ui/domain';
import { nls } from '../nls';

export function FamilyTab({
  entityId,
  families,
  api,
  persons,
  associations,
  sources,
  media,
  mediaApi,
  onOpenMedia,
  onOpenSource,
  onClose,
}: {
  entityId: string;
  families: FamilyRecord[];
  api: FamilyEditorApi;
  persons: PersonRecord[];
  associations: AssociationRecord[];
  sources: SourceRecord[];
  media: MediaWithPath[];
  mediaApi: MediaTargetApi;
  onOpenMedia: (mediaId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onClose: () => void;
}) {
  const familyId = entityId;
  const record = families.find((family) => family.id === familyId);
  if (!record) {
    return <p className="person-missing">{nls.t('features.tree.familyNotFound')}</p>;
  }
  return (
    <FamilyTabBody
      record={record}
      families={families}
      api={api}
      persons={persons}
      associations={associations}
      sources={sources}
      media={media}
      mediaApi={mediaApi}
      onOpenMedia={onOpenMedia}
      onOpenSource={onOpenSource}
      onClose={onClose}
    />
  );
}

function FamilyTabBody({
  record,
  families,
  api,
  persons,
  associations,
  sources,
  media,
  mediaApi,
  onOpenMedia,
  onOpenSource,
  onClose,
}: {
  record: FamilyRecord;
  families: FamilyRecord[];
  api: FamilyEditorApi;
  persons: PersonRecord[];
  associations: AssociationRecord[];
  sources: SourceRecord[];
  media: MediaWithPath[];
  mediaApi: MediaTargetApi;
  onOpenMedia: (mediaId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FamilyDraft>(() => familyToDraft(record));
  const familyAssociations = useMemo(
    () => associations.filter((association) => association.familyId === record.id),
    [associations, record.id],
  );
  const {
    notes: familyNotes,
    allNotes,
    citations: familyCitations,
    tags,
    tagLinks,
    identifiers,
    contacts,
    restrictions,
    submitters,
    contributors,
    refresh: refreshAttachments,
  } = useAttachments('family', record.id, api, true);
  const recordRef = useRef(record);

  // Reset the draft only when it still equals the previous stored family —
  // i.e. the user has no unsaved edits. Unrelated tree reloads (a fact
  // added elsewhere) must not clobber in-progress edits.
  useEffect(() => {
    if (record === recordRef.current) {
      return;
    }
    const previous = recordRef.current;
    recordRef.current = record;
    setDraft((current) => (familyDraftMatches(current, previous) ? familyToDraft(record) : current));
  }, [record]);

  const save = async () => {
    await api.updateFamily(record, familyDraftToRecord(draft, record));
  };

  const remove = async () => {
    await api.deleteFamily(record);
    onClose();
  };

  return (
    <EntityTab>
      <FamilyEditor
        draft={draft}
        onChange={setDraft}
        persons={persons}
        families={families}
        associations={familyAssociations}
        sources={sources}
        api={api}
        savedLinkIds={
          new Set([
            ...(record.partnerLinks ?? []).map((link) => link.id),
            ...(record.childLinks ?? []).map((link) => link.id),
          ])
        }
        renderStatusAttachments={(statusId) => (
          <AttachmentsPanel
            targetType="family_marriage_status"
            targetId={statusId}
            api={api}
            sources={sources}
            onOpenSource={onOpenSource}
          />
        )}
        renderLinkAttachments={(kind, linkId) => (
          <AttachmentsPanel
            targetType={kind === 'partner' ? 'family_partner' : 'family_child'}
            targetId={linkId}
            api={api}
            sources={sources}
            onOpenSource={onOpenSource}
          />
        )}
        onSave={() => void save()}
        onDelete={() => void remove()}
        onOpenSource={onOpenSource}
      />
      <SourcesSection
        targetType="family"
        targetId={record.id}
        sources={sources}
        citations={familyCitations}
        refresh={refreshAttachments}
        onAddSource={api.addSource}
        onAttachSource={api.attachSource}
        onDetachCitation={api.detachCitation}
        onUpdateCitation={api.updateCitation}
        onOpenSource={onOpenSource}
        renderCitationAttachments={(citation) => (
          <CitationAttachments citation={citation} api={api} sources={sources} onOpenSource={onOpenSource} />
        )}
      />
      <NotesSection
        targetType="family"
        targetId={record.id}
        notes={familyNotes}
        availableNotes={allNotes}
        onAdd={async (text) => {
          await api.addNote({ id: crypto.randomUUID(), text, targetType: 'family', targetId: record.id });
          await refreshAttachments();
        }}
        onUpdate={async (before, after, context) => {
          await api.updateNote(before, after, context);
          await refreshAttachments();
        }}
        onAttach={async (noteId) => {
          await api.attachNote(noteId, { id: crypto.randomUUID(), targetType: 'family', targetId: record.id });
          await refreshAttachments();
        }}
        onDetach={async (note, link) => {
          await api.detachNote(note, link);
          await refreshAttachments();
        }}
        onDelete={async (note) => {
          await api.deleteNote(note);
          await refreshAttachments();
        }}
        renderAttachments={(note) => (
          <NoteAttachments note={note} api={api} sources={sources} onOpenSource={onOpenSource} />
        )}
      />
      <IdentifiersSection
        targetType="family"
        targetId={record.id}
        identifiers={identifiers}
        onAdd={async (identifier) => {
          await api.addIdentifier(identifier);
          await refreshAttachments();
        }}
        onUpdate={async (before, after) => {
          await api.updateIdentifier(before, after);
          await refreshAttachments();
        }}
        onDelete={async (identifier) => {
          await api.deleteIdentifier(identifier);
          await refreshAttachments();
        }}
      />
      <ContactsSection
        targetType="family"
        targetId={record.id}
        contacts={contacts}
        onAdd={async (contact) => {
          await api.addContact(contact);
          await refreshAttachments();
        }}
        onUpdate={async (before, after) => {
          await api.updateContact(before, after);
          await refreshAttachments();
        }}
        onDelete={async (contact) => {
          await api.deleteContact(contact);
          await refreshAttachments();
        }}
      />
      <RestrictionsSection
        targetType="family"
        targetId={record.id}
        restrictions={restrictions}
        onAdd={async (restriction) => {
          await api.addRestriction(restriction);
          await refreshAttachments();
        }}
        onUpdate={async (before, after) => {
          await api.updateRestriction(before, after);
          await refreshAttachments();
        }}
        onDelete={async (restriction) => {
          await api.deleteRestriction(restriction);
          await refreshAttachments();
        }}
      />
      <TagsSection
        targetType="family"
        targetId={record.id}
        tags={tags}
        tagLinks={tagLinks}
        onAddTag={api.addTag}
        onUpdateTag={api.updateTag}
        onDeleteTag={api.deleteTag}
        onAttachTag={async (link) => {
          await api.attachTag(link);
          await refreshAttachments();
        }}
        onDetachTag={async (link) => {
          await api.detachTag(link);
          await refreshAttachments();
        }}
      />
      <MediaSection
        targetType="family"
        targetId={record.id}
        media={media.filter((item) =>
          item.links?.some((link) => link.targetType === 'family' && link.targetId === record.id),
        )}
        api={mediaApi}
        refresh={async () => undefined}
        onOpenMedia={onOpenMedia}
      />
      <ContributorsSection
        targetType="family"
        targetId={record.id}
        submitters={submitters}
        links={contributors}
        onAdd={api.addRecordSubmitter}
        onDelete={api.deleteRecordSubmitter}
      />
      <TasksSection targetType="family" targetId={record.id} api={api} />
    </EntityTab>
  );
}

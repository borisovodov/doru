import { useEffect, useRef, useState } from 'react';
import type { FactRecord, FamilyRecord, PersonRecord, PlaceRecord, SourceRecord } from '@doru/core';
import { AttachmentsPanel, CitationAttachments, NoteAttachments, useAttachments } from '../attachments';
import { MediaSection } from '../media/MediaSection';
import { AutoSaveError } from '../autoSaveFeedback';
import { EntityTab } from '../sidebar';
import { Button, DangerZone, useAutoSaveOnBlur } from '@doru/ui';
import type { MediaTargetApi, PlaceEditorApi } from '../person/types';
import { PlaceEditor } from './PlaceEditor';
import { PlaceFactsList } from './PlaceFactsList';
import {
  emptyPlaceDraft,
  mergePlaceDraft,
  placeDraftMatches,
  placeDraftToRecord,
  placeToDraft,
  type PlaceDraft,
} from './placeDraft';
import type { MediaWithPath } from '@doru/ui/domain';
import {
  ContactsSection,
  ContributorsSection,
  IdentifiersSection,
  NotesSection,
  RestrictionsSection,
  SourcesSection,
  TagsSection,
  TasksSection,
} from '@doru/ui/domain';
import { nls } from '../nls';

/** A new place starts with the placeholder text as the first name value. */
function newPlaceDraft(): PlaceDraft {
  const draft = emptyPlaceDraft();
  const first = draft.names[0];
  return first === undefined
    ? draft
    : { ...draft, names: [{ ...first, value: nls.t('features.tree.place.newPlace') }] };
}

export function PlaceTab({
  entityId,
  places,
  api,
  persons,
  families,
  facts,
  sources,
  media,
  mediaApi,
  onOpenPerson,
  onOpenMedia,
  onOpenSource,
  onClose,
  onCreated,
}: {
  entityId: string;
  places: PlaceRecord[];
  api: PlaceEditorApi;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  sources: SourceRecord[];
  media: MediaWithPath[];
  mediaApi: MediaTargetApi;
  onOpenPerson: (personId: string) => void;
  onOpenMedia: (mediaId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onClose: () => void;
  onCreated: (realId: string) => void;
}) {
  const placeId = entityId;
  const isNew = placeId.startsWith('new:');
  const record = places.find((place) => place.id === placeId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tree.place.notFound')}</p>;
  }
  return (
    <PlaceTabBody
      record={record}
      isNew={isNew}
      places={places}
      api={api}
      persons={persons}
      families={families}
      facts={facts}
      sources={sources}
      media={media}
      mediaApi={mediaApi}
      onOpenPerson={onOpenPerson}
      onOpenMedia={onOpenMedia}
      onOpenSource={onOpenSource}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function PlaceTabBody({
  record,
  isNew,
  places,
  api,
  persons,
  families,
  facts,
  sources,
  media,
  mediaApi,
  onOpenPerson,
  onOpenMedia,
  onOpenSource,
  onClose,
  onCreated,
}: {
  record: PlaceRecord | undefined;
  isNew: boolean;
  places: PlaceRecord[];
  api: PlaceEditorApi;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  sources: SourceRecord[];
  media: MediaWithPath[];
  mediaApi: MediaTargetApi;
  onOpenPerson: (personId: string) => void;
  onOpenMedia: (mediaId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onClose: () => void;
  onCreated: (realId: string) => void;
}) {
  const [draft, setDraftState] = useState<PlaceDraft>(() =>
    isNew ? newPlaceDraft() : record ? placeToDraft(record) : newPlaceDraft(),
  );
  const [lastSaved, setLastSaved] = useState<PlaceRecord | undefined>(record);
  const recordRef = useRef(record);
  const draftRef = useRef(draft);
  const baselineRef = useRef(record);
  const submittedRef = useRef<PlaceDraft | undefined>(undefined);
  const submittedRecordRef = useRef<PlaceRecord | undefined>(undefined);
  const submissionTokenRef = useRef<object | undefined>(undefined);
  const setDraft = (next: PlaceDraft) => {
    draftRef.current = next;
    setDraftState(next);
  };

  const targetId = (lastSaved ?? record)?.id;
  const {
    notes: placeNotes,
    allNotes,
    citations: placeCitations,
    tags,
    tagLinks,
    identifiers,
    contacts,
    restrictions,
    submitters,
    contributors,
    refresh: refreshAttachments,
  } = useAttachments('place', targetId, api, true);

  // Reset the draft only when it still equals the previous stored place —
  // i.e. the user has no unsaved edits. Unrelated tree reloads must not
  // clobber in-progress edits.
  useEffect(() => {
    if (isNew || record === undefined || record === recordRef.current) {
      return;
    }
    const previous = recordRef.current;
    recordRef.current = record;
    if (previous !== undefined) {
      const submittedRecord = submittedRecordRef.current;
      const confirms =
        submittedRecord !== undefined &&
        JSON.stringify(placeToDraft(record)) === JSON.stringify(placeToDraft(submittedRecord));
      const submitted = confirms ? submittedRef.current : undefined;
      if (confirms) {
        submittedRef.current = undefined;
        submittedRecordRef.current = undefined;
      }
      baselineRef.current = record;
      setDraft(mergePlaceDraft(draftRef.current, previous, record, submitted));
      setLastSaved(record);
    }
  }, [record, isNew]);

  const save = async () => {
    const target = lastSaved ?? record;
    const next = placeDraftToRecord(draftRef.current, lastSaved ?? record ?? baselineRef.current);
    if (isNew && lastSaved === undefined) {
      await api.addPlace(next);
      onCreated(next.id);
    } else {
      if (target === undefined) {
        return;
      }
      const submission = draftRef.current;
      const token = {};
      submissionTokenRef.current = token;
      submittedRef.current = submission;
      try {
        await api.updatePlace(target, next);
        if (submissionTokenRef.current === token) {
          submittedRecordRef.current = next;
        }
      } catch (error) {
        if (submissionTokenRef.current === token && submittedRef.current === submission) {
          submittedRef.current = undefined;
          submittedRecordRef.current = undefined;
        }
        throw error;
      }
      if (submissionTokenRef.current !== token) {
        return;
      }
    }
    baselineRef.current = next;
    setLastSaved(next);
  };

  const remove = async () => {
    const target = lastSaved ?? record;
    if (target) {
      await api.deletePlace(target);
    }
    onClose();
  };

  const autoSave = useAutoSaveOnBlur({
    enabled: !isNew,
    isDirty: () => {
      const persisted = lastSaved ?? record;
      return persisted !== undefined && !placeDraftMatches(draft, persisted);
    },
    save,
  });

  const currentPlace = lastSaved ?? record;
  const factsAtPlace =
    currentPlace !== undefined
      ? facts.filter(
          (fact) => fact.placeId === currentPlace.id || (fact.additionalPlaceIds ?? []).includes(currentPlace.id),
        )
      : [];

  return (
    <EntityTab>
      <PlaceEditor
        draft={draft}
        onBlur={autoSave.onBlur}
        notice={<AutoSaveError failed={autoSave.failed} onRetry={autoSave.retry} />}
        onChange={setDraft}
        places={places}
        onSave={() => void save()}
        renderAttachments={(linkId) => (
          <AttachmentsPanel
            targetType="place_hierarchy"
            targetId={linkId}
            api={api}
            sources={sources}
            onOpenSource={onOpenSource}
          />
        )}
        renderNameAttachments={(nameId) => (
          <AttachmentsPanel
            targetType="place_name"
            targetId={nameId}
            api={api}
            sources={sources}
            onOpenSource={onOpenSource}
          />
        )}
      />
      {(lastSaved !== undefined || record !== undefined) && (
        <>
          <PlaceFactsList facts={factsAtPlace} persons={persons} families={families} onOpenPerson={onOpenPerson} />
          {targetId !== undefined && (
            <>
              <SourcesSection
                targetType="place"
                targetId={targetId}
                sources={sources}
                citations={placeCitations}
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
                targetType="place"
                targetId={targetId}
                notes={placeNotes}
                availableNotes={allNotes}
                onAdd={async (text) => {
                  await api.addNote({ id: crypto.randomUUID(), text, targetType: 'place', targetId });
                  await refreshAttachments();
                }}
                onUpdate={async (before, after, context) => {
                  await api.updateNote(before, after, context);
                  await refreshAttachments();
                }}
                onAttach={async (noteId) => {
                  await api.attachNote(noteId, { id: crypto.randomUUID(), targetType: 'place', targetId });
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
                targetType="place"
                targetId={targetId}
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
                targetType="place"
                targetId={targetId}
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
                targetType="place"
                targetId={targetId}
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
                targetType="place"
                targetId={targetId}
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
                targetType="place"
                targetId={targetId}
                media={media.filter((item) =>
                  item.links?.some((link) => link.targetType === 'place' && link.targetId === targetId),
                )}
                api={mediaApi}
                refresh={async () => undefined}
                onOpenMedia={onOpenMedia}
              />
              <ContributorsSection
                targetType="place"
                targetId={targetId}
                submitters={submitters}
                links={contributors}
                onAdd={api.addRecordSubmitter}
                onDelete={api.deleteRecordSubmitter}
              />
              <TasksSection targetType="place" targetId={targetId} api={api} />
            </>
          )}
        </>
      )}
      {(!isNew || lastSaved !== undefined) && (
        <DangerZone>
          <Button
            variant="danger"
            size="sm"
            data-autosave-skip="true"
            onClick={() => {
              autoSave.cancel();
              void remove();
            }}
          >
            {nls.t('features.tree.fact.delete')}
          </Button>
        </DangerZone>
      )}
    </EntityTab>
  );
}

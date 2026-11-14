import { useEffect, useRef, useState } from 'react';
import type { FactRecord, FamilyRecord, PersonRecord, PlaceRecord, SourceRecord } from '@doru/core';
import {
  EntityTab,
  PlaceEditor,
  PlaceFactsList,
  emptyPlaceDraft,
  placeDraftMatches,
  placeDraftToRecord,
  placeToDraft,
  type PlaceDraft,
  type PlaceEditorApi,
} from '@doru/features';
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
import { nls } from '@doru/workbench';
import { CitationAttachments, NoteAttachments, useAttachments } from '@doru/features';
import { PLACE_TAB_PREFIX } from '../hooks/useTabs';

export function PlaceTab({
  tabId,
  places,
  api,
  persons,
  families,
  facts,
  sources,
  onOpenPerson,
  onOpenSource,
  onClose,
  onCreated,
}: {
  tabId: string;
  places: PlaceRecord[];
  api: PlaceEditorApi;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  sources: SourceRecord[];
  onOpenPerson: (personId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onClose: (tabId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const placeId = tabId.slice(PLACE_TAB_PREFIX.length);
  const isNew = placeId.startsWith('new:');
  const record = places.find((place) => place.id === placeId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tree.place.notFound')}</p>;
  }
  return (
    <PlaceTabBody
      tabId={tabId}
      record={record}
      isNew={isNew}
      places={places}
      api={api}
      persons={persons}
      families={families}
      facts={facts}
      sources={sources}
      onOpenPerson={onOpenPerson}
      onOpenSource={onOpenSource}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function PlaceTabBody({
  tabId,
  record,
  isNew,
  places,
  api,
  persons,
  families,
  facts,
  sources,
  onOpenPerson,
  onOpenSource,
  onClose,
  onCreated,
}: {
  tabId: string;
  record: PlaceRecord | undefined;
  isNew: boolean;
  places: PlaceRecord[];
  api: PlaceEditorApi;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  sources: SourceRecord[];
  onOpenPerson: (personId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onClose: (tabId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const [draft, setDraft] = useState<PlaceDraft>(() =>
    isNew ? emptyPlaceDraft() : record ? placeToDraft(record) : emptyPlaceDraft(),
  );
  const [lastSaved, setLastSaved] = useState<PlaceRecord | undefined>(record);
  const recordRef = useRef(record);

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
    changes,
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
    setDraft((current) =>
      previous !== undefined && placeDraftMatches(current, previous) ? placeToDraft(record) : current,
    );
  }, [record, isNew]);

  const save = async () => {
    const next = placeDraftToRecord(draft);
    if (isNew && lastSaved === undefined) {
      await api.addPlace(next);
      onCreated(next.id);
    } else {
      const target = lastSaved ?? record;
      if (target === undefined) {
        return;
      }
      await api.updatePlace(target, next);
    }
    setLastSaved(next);
  };

  const remove = async () => {
    const target = lastSaved ?? record;
    if (target) {
      await api.deletePlace(target);
    }
    onClose(tabId);
  };

  const currentPlace = lastSaved ?? record;
  const factsAtPlace = currentPlace !== undefined ? facts.filter((fact) => fact.placeId === currentPlace.id) : [];

  return (
    <EntityTab>
      <PlaceEditor
        draft={draft}
        onChange={setDraft}
        places={places}
        onSave={() => void save()}
        onDelete={!isNew || lastSaved !== undefined ? () => void remove() : undefined}
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
                onUpdateTagLink={async (before, after) => {
                  await api.updateTagLink(before, after);
                  await refreshAttachments();
                }}
              />
              <ContributorsSection
                targetType="place"
                targetId={targetId}
                submitters={submitters}
                links={contributors}
                onAdd={api.addRecordSubmitter}
                onDelete={api.deleteRecordSubmitter}
              />
              <ChangesSection changes={changes} />
            </>
          )}
        </>
      )}
    </EntityTab>
  );
}

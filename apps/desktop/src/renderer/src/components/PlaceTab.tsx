import { useEffect, useRef, useState } from 'react';
import type {
  CitationRecord,
  ContactRecord,
  FactRecord,
  FamilyRecord,
  IdentifierRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  RestrictionRecord,
  SourceRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
} from '@doru/core';
import {
  ContactsSection,
  ContributorsSection,
  EntityTab,
  IdentifiersSection,
  NotesSection,
  PlaceEditor,
  PlaceFactsList,
  RestrictionsSection,
  SourcesSection,
  TagsSection,
  emptyPlaceDraft,
  placeDraftMatches,
  placeDraftToRecord,
  placeToDraft,
  type PlaceDraft,
  type PlaceEditorApi,
} from '@doru/features';
import { nls } from '@doru/workbench';
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
  const [placeNotes, setPlaceNotes] = useState<NoteRecord[]>([]);
  const [placeCitations, setPlaceCitations] = useState<CitationRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [tagLinks, setTagLinks] = useState<Array<{ tagId: string; link: TagLinkRecord }>>([]);
  const [identifiers, setIdentifiers] = useState<IdentifierRecord[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [restrictions, setRestrictions] = useState<RestrictionRecord[]>([]);
  const [submitters, setSubmitters] = useState<SubmitterRecord[]>([]);
  const [contributors, setContributors] = useState<
    Array<{ id: string; submitterId: string; targetType: string; targetId: string }>
  >([]);
  const recordRef = useRef(record);

  const targetId = (lastSaved ?? record)?.id;

  const refreshAttachments = async () => {
    if (targetId === undefined) {
      return;
    }
    const [loadedNotes, loadedCitations, loadedTags, loadedTagLinks, loadedIdentifiers, loadedContacts, loadedRestrictions, loadedSubmitters, loadedContributors] =
      await Promise.all([
        api.getNotes('place', targetId),
        api.getCitations('place', targetId),
        api.getTags(),
        api.getTagLinks('place', targetId),
        api.getIdentifiers('place', targetId),
        api.getContacts('place', targetId),
        api.getRestrictions('place', targetId),
        api.getSubmitters(),
        api.getRecordSubmitters('place', targetId),
      ]);
    setPlaceNotes(loadedNotes);
    setPlaceCitations(loadedCitations);
    setTags(loadedTags);
    setTagLinks(loadedTagLinks);
    setIdentifiers(loadedIdentifiers);
    setContacts(loadedContacts);
    setRestrictions(loadedRestrictions);
    setSubmitters(loadedSubmitters);
    setContributors(loadedContributors);
  };

  useEffect(() => {
    void refreshAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

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
      current && previous !== undefined && placeDraftMatches(current, previous) ? placeToDraft(record) : current,
    );
  }, [record, isNew]);

  const save = async () => {
    const next = placeDraftToRecord(draft);
    if (isNew && lastSaved === undefined) {
      await api.addPlace(next);
      onCreated(next.id);
    } else {
      await api.updatePlace(lastSaved ?? record!, next);
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

  const factsAtPlace =
    lastSaved !== undefined || record !== undefined
      ? facts.filter((fact) => fact.placeId === (lastSaved ?? record)!.id)
      : [];

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
              />
              <NotesSection
                targetType="place"
                targetId={targetId}
                notes={placeNotes}
                onAdd={async (text) => {
                  await api.addNote({ id: crypto.randomUUID(), text, targetType: 'place', targetId });
                  await refreshAttachments();
                }}
                onUpdate={async (before, after, context) => {
                  await api.updateNote(before, after, context);
                  await refreshAttachments();
                }}
                onDelete={async (note) => {
                  await api.deleteNote(note);
                  await refreshAttachments();
                }}
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
            </>
          )}
        </>
      )}
    </EntityTab>
  );
}

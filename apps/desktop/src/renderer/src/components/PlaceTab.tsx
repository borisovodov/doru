import { useEffect, useRef, useState } from 'react';
import type { FactRecord, FamilyRecord, PersonRecord, PlaceRecord } from '@doru/core';
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
import { nls } from '@doru/workbench';
import { PLACE_TAB_PREFIX } from '../hooks/useTabs';

export function PlaceTab({
  tabId,
  places,
  api,
  persons,
  families,
  facts,
  onOpenPerson,
  onClose,
}: {
  tabId: string;
  places: PlaceRecord[];
  api: PlaceEditorApi;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  onOpenPerson: (personId: string) => void;
  onClose: (tabId: string) => void;
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
      onOpenPerson={onOpenPerson}
      onClose={onClose}
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
  onOpenPerson,
  onClose,
}: {
  tabId: string;
  record: PlaceRecord | undefined;
  isNew: boolean;
  places: PlaceRecord[];
  api: PlaceEditorApi;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  onOpenPerson: (personId: string) => void;
  onClose: (tabId: string) => void;
}) {
  const [draft, setDraft] = useState<PlaceDraft>(() =>
    isNew ? emptyPlaceDraft() : record ? placeToDraft(record) : emptyPlaceDraft(),
  );
  const [lastSaved, setLastSaved] = useState<PlaceRecord | undefined>(record);
  const recordRef = useRef(record);

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
        <PlaceFactsList facts={factsAtPlace} persons={persons} families={families} onOpenPerson={onOpenPerson} />
      )}
    </EntityTab>
  );
}

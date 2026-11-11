import { useEffect, useRef, useState } from 'react';
import type { FactRecord, FamilyRecord, PersonRecord, PlaceRecord } from '@doru/core';
import {
  EntityTab,
  PlaceEditor,
  PlaceFactsList,
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
  const record = places.find((place) => place.id === placeId);
  if (!record) {
    return <p className="person-missing">{nls.t('features.tree.place.notFound')}</p>;
  }
  return (
    <PlaceTabBody
      tabId={tabId}
      record={record}
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
  places,
  api,
  persons,
  families,
  facts,
  onOpenPerson,
  onClose,
}: {
  tabId: string;
  record: PlaceRecord;
  places: PlaceRecord[];
  api: PlaceEditorApi;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  onOpenPerson: (personId: string) => void;
  onClose: (tabId: string) => void;
}) {
  const [draft, setDraft] = useState<PlaceDraft>(() => placeToDraft(record));
  const recordRef = useRef(record);

  // Reset the draft only when it still equals the previous stored place —
  // i.e. the user has no unsaved edits. Unrelated tree reloads must not
  // clobber in-progress edits.
  useEffect(() => {
    if (record === recordRef.current) {
      return;
    }
    const previous = recordRef.current;
    recordRef.current = record;
    setDraft((current) =>
      current && placeDraftMatches(current, previous) ? placeToDraft(record) : current,
    );
  }, [record]);

  const save = async () => {
    await api.updatePlace(record, placeDraftToRecord(draft));
  };

  const remove = async () => {
    await api.deletePlace(record);
    onClose(tabId);
  };

  const factsAtPlace = facts.filter((fact) => fact.placeId === record.id);

  return (
    <EntityTab>
      <PlaceEditor
        draft={draft}
        onChange={setDraft}
        places={places}
        onSave={() => void save()}
        onDelete={() => void remove()}
      />
      <PlaceFactsList facts={factsAtPlace} persons={persons} families={families} onOpenPerson={onOpenPerson} />
    </EntityTab>
  );
}

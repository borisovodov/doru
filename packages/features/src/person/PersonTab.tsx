import { useEffect, useRef, useState } from 'react';
import type { PersonRecord } from '@doru/core';
import { PersonEditor } from './PersonEditor';
import type { MediaTargetApi, PersonEditorApi } from './types';
import { nls } from '../nls';
import { draftToRecord, newPersonDraft, personDraftMatches, personToDraft, type PersonDraft } from '@doru/ui/domain';

export function PersonTab({
  entityId,
  persons,
  api,
  mediaApi,
  onOpenMedia,
  onClose,
  onCreated,
  onDeletePerson,
}: {
  entityId: string;
  persons: PersonRecord[];
  api: PersonEditorApi;
  mediaApi: MediaTargetApi;
  onOpenMedia: (mediaId: string) => void;
  onClose: () => void;
  onCreated: (realId: string) => void;
  onDeletePerson: (person: PersonRecord) => Promise<void>;
}) {
  const personId = entityId;
  const isNew = personId.startsWith('new:');
  const record = persons.find((person) => person.id === personId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tree.personNotFound')}</p>;
  }
  return (
    <PersonTabBody
      personId={personId}
      isNew={isNew}
      persons={persons}
      api={api}
      mediaApi={mediaApi}
      onOpenMedia={onOpenMedia}
      onClose={onClose}
      onCreated={onCreated}
      onDeletePerson={onDeletePerson}
    />
  );
}

function PersonTabBody({
  personId,
  isNew,
  persons,
  api,
  mediaApi,
  onOpenMedia,
  onClose,
  onCreated,
  onDeletePerson,
}: {
  personId: string;
  isNew: boolean;
  persons: PersonRecord[];
  api: PersonEditorApi;
  mediaApi: MediaTargetApi;
  onOpenMedia: (mediaId: string) => void;
  onClose: () => void;
  onCreated: (realId: string) => void;
  onDeletePerson: (person: PersonRecord) => Promise<void>;
}) {
  const record = persons.find((person) => person.id === personId);
  const [draft, setDraft] = useState<PersonDraft>(() =>
    isNew ? newPersonDraft() : record ? personToDraft(record) : newPersonDraft(),
  );
  const personRef = useRef(record);

  // Reset the draft only when it still equals the previously stored person
  // (no unsaved edits); unrelated tree reloads (a fact added elsewhere)
  // must not clobber in-progress edits.
  useEffect(() => {
    if (isNew) {
      return;
    }
    const person = persons.find((entry) => entry.id === personId);
    if (!person) {
      return;
    }
    if (person === personRef.current) {
      return;
    }
    const previous = personRef.current;
    personRef.current = person;
    setDraft((current) => {
      if (current.isNew || previous === undefined || personDraftMatches(current, previous)) {
        return personToDraft(person);
      }
      const refreshed = personToDraft(person);
      return {
        ...current,
        names: current.namesTouched === true ? current.names : refreshed.names,
        sex: current.sexTouched === true ? current.sex : refreshed.sex,
        deathStatus: current.deathStatusTouched === true ? current.deathStatus : refreshed.deathStatus,
        addressId: current.addressTouched === true ? current.addressId : refreshed.addressId,
        birth: current.birthTouched === true ? current.birth : refreshed.birth,
        death: current.deathTouched === true ? current.death : refreshed.death,
      };
    });
  }, [personId, persons, isNew]);

  const [created, setCreated] = useState(false);

  const save = async () => {
    const before = persons.find((entry) => entry.id === draft.id);
    const next = draftToRecord(draft, before);
    if (before === undefined) {
      await api.addPerson(next);
      setCreated(true);
      onCreated(next.id);
      return;
    }
    await api.updatePerson(before, next);
  };

  return (
    <PersonEditor
      key={draft.isNew ? `new:${draft.id}` : draft.id}
      draft={draft}
      persons={persons}
      onChange={setDraft}
      onSave={() => void save()}
      onDelete={
        !draft.isNew && record !== undefined
          ? () => {
              void onDeletePerson(record).then(() => onClose());
            }
          : undefined
      }
      onCancel={draft.isNew && !created ? () => onClose() : undefined}
      api={api}
      mediaApi={mediaApi}
      onOpenMedia={onOpenMedia}
    />
  );
}

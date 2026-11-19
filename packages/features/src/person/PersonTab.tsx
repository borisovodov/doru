import { useEffect, useRef, useState } from 'react';
import type { PersonRecord } from '@doru/core';
import { PersonEditor } from './PersonEditor';
import type { MediaTargetApi, PersonEditorApi } from './types';
import { nls } from '../nls';
import { draftToRecord, newPersonDraft, personDraftMatches, personToDraft, type PersonDraft } from '@doru/ui/domain';

const sameDraftValue = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

function mergePersonDraft(current: PersonDraft, base: PersonDraft, refreshed: PersonDraft): PersonDraft {
  const names = sameDraftValue(current.names, base.names) ? refreshed.names : current.names;
  const birth = sameDraftValue(current.birth, base.birth) ? refreshed.birth : current.birth;
  const death = sameDraftValue(current.death, base.death) ? refreshed.death : current.death;
  return {
    ...current,
    names,
    namesTouched: names === refreshed.names ? false : current.namesTouched,
    sex: current.sex === base.sex ? refreshed.sex : current.sex,
    sexTouched: current.sex === base.sex ? false : current.sexTouched,
    deathStatus: current.deathStatus === base.deathStatus ? refreshed.deathStatus : current.deathStatus,
    deathStatusTouched: current.deathStatus === base.deathStatus ? false : current.deathStatusTouched,
    addressId: current.addressId === base.addressId ? refreshed.addressId : current.addressId,
    addressTouched: current.addressId === base.addressId ? false : current.addressTouched,
    birth,
    birthTouched: birth === refreshed.birth ? false : current.birthTouched,
    death,
    deathTouched: death === refreshed.death ? false : current.deathTouched,
  };
}

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
  const committedRef = useRef<PersonRecord | undefined>(undefined);
  const submittedRef = useRef<PersonDraft | undefined>(undefined);
  const submittedRecordRef = useRef<PersonRecord | undefined>(undefined);

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
    const submittedRecord = submittedRecordRef.current;
    const confirms =
      submittedRecord !== undefined &&
      JSON.stringify(personToDraft(person)) === JSON.stringify(personToDraft(submittedRecord));
    const submitted = confirms ? submittedRef.current : undefined;
    if (confirms) {
      submittedRef.current = undefined;
      submittedRecordRef.current = undefined;
      committedRef.current = undefined;
    } else {
      // A newer authoritative snapshot replaces the fallback: later saves
      // must use the stored value, not the last write's memory.
      committedRef.current = person;
    }
    setDraft((current) => {
      if (current.isNew || previous === undefined) {
        return personToDraft(person);
      }
      const refreshed = personToDraft(person);
      if (submitted === undefined && personDraftMatches(current, previous)) {
        return refreshed;
      }
      return mergePersonDraft(current, submitted ?? personToDraft(previous), refreshed);
    });
  }, [personId, persons, isNew]);

  const [created, setCreated] = useState(false);

  const save = async () => {
    const before = committedRef.current ?? persons.find((entry) => entry.id === draft.id);
    const next = draftToRecord(draft, before);
    if (before === undefined) {
      await api.addPerson(next);
      setCreated(true);
      onCreated(next.id);
      return;
    }
    const submission = draft;
    submittedRef.current = submission;
    try {
      await api.updatePerson(before, next);
      committedRef.current = next;
      submittedRecordRef.current = next;
    } catch (error) {
      // Retry from the latest published snapshot rather than reusing a
      // baseline whose facts another writer may have deleted.
      committedRef.current = undefined;
      if (submittedRef.current === submission) {
        submittedRef.current = undefined;
        submittedRecordRef.current = undefined;
      }
      throw error;
    }
    const persisted = personToDraft(next);
    setDraft((current) => {
      const patch: Partial<PersonDraft> = {};
      if (current.sex === draft.sex) {
        patch.sex = persisted.sex;
        patch.sexTouched = false;
      }
      if (current.deathStatus === draft.deathStatus) {
        patch.deathStatus = persisted.deathStatus;
        patch.deathStatusTouched = false;
      }
      if (current.addressId === draft.addressId) {
        patch.addressId = persisted.addressId;
        patch.addressTouched = false;
      }
      if (sameDraftValue(current.names, draft.names)) {
        patch.names = persisted.names;
        patch.namesTouched = false;
      }
      if (sameDraftValue(current.birth, draft.birth)) {
        patch.birth = persisted.birth;
        patch.birthTouched = false;
      }
      if (sameDraftValue(current.death, draft.death)) {
        patch.death = persisted.death;
        patch.deathTouched = false;
      }
      return Object.keys(patch).length > 0 ? { ...current, ...patch } : current;
    });
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

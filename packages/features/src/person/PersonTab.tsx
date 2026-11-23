import { useEffect, useRef, useState } from 'react';
import type { PersonRecord } from '@doru/core';
import { PersonEditor } from './PersonEditor';
import type { MediaTargetApi, PersonEditorApi } from './types';
import { nls } from '../nls';
import { AutoSaveError } from '../autoSaveFeedback';
import { useEntityDelete } from '../entityDelete';
import { Button, DangerZone, InlineError, useAutoSaveOnBlur } from '@doru/ui';
import { draftToRecord, newPersonDraft, personDraftMatches, personToDraft, type PersonDraft } from '@doru/ui/domain';

const sameDraftValue = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

function mergePersonDraft(
  current: PersonDraft,
  base: PersonDraft,
  refreshed: PersonDraft,
  protectedDraft?: PersonDraft,
  protectedBase?: PersonDraft,
): PersonDraft {
  // Fields touched by an in-flight write keep the current value (including a
  // post-submission reversal) until the write is acknowledged. Compare them
  // with the submission's baseline so a value another writer changed does not
  // turn an untouched submitted field into a protected one.
  const protectedField = (key: keyof PersonDraft): boolean =>
    protectedDraft !== undefined && !sameDraftValue(protectedDraft[key], (protectedBase ?? base)[key]);
  const names = protectedField('names') || !sameDraftValue(current.names, base.names) ? current.names : refreshed.names;
  const birth = protectedField('birth') || !sameDraftValue(current.birth, base.birth) ? current.birth : refreshed.birth;
  const death = protectedField('death') || !sameDraftValue(current.death, base.death) ? current.death : refreshed.death;
  return {
    ...current,
    names,
    namesTouched: protectedField('names') || names !== refreshed.names ? current.namesTouched : false,
    sex: protectedField('sex') || current.sex !== base.sex ? current.sex : refreshed.sex,
    sexTouched: protectedField('sex') || current.sex !== base.sex ? current.sexTouched : false,
    deathStatus:
      protectedField('deathStatus') || current.deathStatus !== base.deathStatus
        ? current.deathStatus
        : refreshed.deathStatus,
    deathStatusTouched:
      protectedField('deathStatus') || current.deathStatus !== base.deathStatus ? current.deathStatusTouched : false,
    addressId:
      protectedField('addressId') || current.addressId !== base.addressId ? current.addressId : refreshed.addressId,
    addressTouched:
      protectedField('addressId') || current.addressId !== base.addressId ? current.addressTouched : false,
    birth,
    birthTouched: protectedField('birth') || birth !== refreshed.birth ? current.birthTouched : false,
    death,
    deathTouched: protectedField('death') || death !== refreshed.death ? current.deathTouched : false,
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
    isNew ? newPersonDraft(nls.t('features.tree.person.newPerson')) : record ? personToDraft(record) : newPersonDraft(),
  );
  const personRef = useRef(record);
  const committedRef = useRef<PersonRecord | undefined>(undefined);
  const submittedRef = useRef<PersonDraft | undefined>(undefined);
  const submittedBaselineRef = useRef<PersonDraft | undefined>(undefined);
  const submittedRecordRef = useRef<PersonRecord | undefined>(undefined);
  const submissionTokenRef = useRef<object | undefined>(undefined);

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
    const protectedDraft = submittedRef.current !== undefined && !confirms ? submittedRef.current : undefined;
    const protectedBase = protectedDraft !== undefined ? submittedBaselineRef.current : undefined;
    if (confirms) {
      submittedRef.current = undefined;
      submittedBaselineRef.current = undefined;
      submittedRecordRef.current = undefined;
      submissionTokenRef.current = undefined;
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
      return mergePersonDraft(current, submitted ?? personToDraft(previous), refreshed, protectedDraft, protectedBase);
    });
  }, [personId, persons, isNew]);

  const [created, setCreated] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const save = async () => {
    setSaveError(false);
    try {
      const committedAtStart = committedRef.current;
      const before = committedAtStart ?? persons.find((entry) => entry.id === draft.id);
      const next = draftToRecord(draft, before);
      if (before === undefined) {
        await api.addPerson(next);
        setCreated(true);
        onCreated(next.id);
        return;
      }
      const submission = draft;
      const personAtStart = personRef.current;
      const token = {};
      submissionTokenRef.current = token;
      submittedRef.current = submission;
      submittedBaselineRef.current = personToDraft(before);
      // A new write invalidates the previous write's acknowledgement.
      submittedRecordRef.current = undefined;
      try {
        await api.updatePerson(before, next);
        if (submissionTokenRef.current === token) {
          if (committedRef.current === committedAtStart) {
            committedRef.current = next;
          }
          submittedRecordRef.current = next;
        }
      } catch (error) {
        if (submissionTokenRef.current === token) {
          // A newer snapshot is the best retry baseline; otherwise keep the
          // previously acknowledged one instead of clearing it.
          committedRef.current = personRef.current !== personAtStart ? personRef.current : committedAtStart;
          if (submittedRef.current === submission) {
            submittedRef.current = undefined;
            submittedBaselineRef.current = undefined;
            submittedRecordRef.current = undefined;
          }
        }
        throw error;
      }
      const persisted = personToDraft(next);
      setDraft((current) => {
        const patch: Partial<PersonDraft> = {};
        if (current.sex === draft.sex) {
          const storedSex = personRef.current !== personAtStart ? personRef.current?.sex : persisted.sex;
          patch.sex = current.sex;
          patch.sexTouched = storedSex !== current.sex;
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
    } catch (error) {
      setSaveError(true);
      throw error;
    }
  };

  const autoSave = useAutoSaveOnBlur({
    enabled: !isNew,
    isDirty: () => {
      const persisted = committedRef.current ?? persons.find((entry) => entry.id === draft.id);
      return persisted !== undefined && !personDraftMatches(draft, persisted);
    },
    save,
  });

  const deletion = useEntityDelete(
    autoSave,
    async () => {
      if (record !== undefined) {
        await onDeletePerson(record);
      }
    },
    onClose,
  );

  return (
    <PersonEditor
      key={draft.isNew ? `new:${draft.id}` : draft.id}
      onBlur={autoSave.onBlur}
      draft={draft}
      persons={persons}
      onChange={(next) => {
        setSaveError(false);
        setDraft(next);
      }}
      onSave={() => void save().catch(() => undefined)}
      onNameRemoved={autoSave.saveSoon}
      onCancel={draft.isNew && !created ? () => onClose() : undefined}
      api={api}
      mediaApi={mediaApi}
      onOpenMedia={onOpenMedia}
      notice={
        <>
          <AutoSaveError failed={autoSave.failed} retryDisabled={autoSave.pendingDelete} onRetry={autoSave.retry} />
          {isNew && saveError ? <InlineError>{nls.t('features.tree.autosaveFailed')}</InlineError> : null}
          {deletion.failed ? <InlineError>{nls.t('features.tree.deleteFailed')}</InlineError> : null}
        </>
      }
      footer={
        !isNew && record !== undefined ? (
          <DangerZone>
            <Button
              variant="danger"
              size="sm"
              data-autosave-skip="true"
              disabled={deletion.deleting}
              onClick={deletion.deleteEntity}
            >
              {nls.t('features.tree.fact.delete')}
            </Button>
          </DangerZone>
        ) : undefined
      }
    />
  );
}

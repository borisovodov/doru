import { useEffect, useRef, useState } from 'react';
import type { PersonRecord } from '@doru/core';
import { PersonEditor, type MediaTargetApi, type PersonEditorApi } from '@doru/features';
import { draftToRecord, newPersonDraft, personDraftMatches, personToDraft, type PersonDraft } from '@doru/ui/domain';
import { nls } from '@doru/workbench';
import { ENTITY_TAB_PREFIX } from '../tabs/types';

export function PersonTab({
  tabId,
  persons,
  api,
  mediaApi,
  onOpenMedia,
  onClose,
  onCreated,
  onDeletePerson,
}: {
  tabId: string;
  persons: PersonRecord[];
  api: PersonEditorApi;
  mediaApi: MediaTargetApi;
  onOpenMedia: (mediaId: string) => void;
  onClose: (tabId: string) => void;
  onCreated: (realId: string) => void;
  onDeletePerson: (person: PersonRecord) => Promise<void>;
}) {
  const personId = tabId.slice(ENTITY_TAB_PREFIX.person.length);
  const isNew = personId.startsWith('new:');
  const record = persons.find((person) => person.id === personId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tree.personNotFound')}</p>;
  }
  return (
    <PersonTabBody
      tabId={tabId}
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
  tabId,
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
  tabId: string;
  personId: string;
  isNew: boolean;
  persons: PersonRecord[];
  api: PersonEditorApi;
  mediaApi: MediaTargetApi;
  onOpenMedia: (mediaId: string) => void;
  onClose: (tabId: string) => void;
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
    setDraft((current) =>
      !current.isNew && previous !== undefined && personDraftMatches(current, previous)
        ? current
        : personToDraft(person),
    );
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
              void onDeletePerson(record).then(() => onClose(tabId));
            }
          : undefined
      }
      onCancel={draft.isNew && !created ? () => onClose(tabId) : undefined}
      api={api}
      mediaApi={mediaApi}
      onOpenMedia={onOpenMedia}
    />
  );
}

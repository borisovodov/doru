import { useEffect, useRef, useState } from 'react';
import type { PersonRecord } from '@doru/core';
import {
  PersonEditor,
  draftToRecord,
  newPersonDraft,
  personDraftMatches,
  personToDraft,
  type PersonDraft,
  type PersonEditorApi,
} from '@doru/features';
import { nls } from '@doru/workbench';
import { PERSON_TAB_PREFIX } from '../hooks/useTabs';

export function PersonTab({
  tabId,
  persons,
  api,
  onClose,
}: {
  tabId: string;
  persons: PersonRecord[];
  api: PersonEditorApi;
  onClose: (tabId: string) => void;
}) {
  const personId = tabId.slice(PERSON_TAB_PREFIX.length);
  const isNew = personId.startsWith('new:');
  const record = persons.find((person) => person.id === personId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tree.personNotFound')}</p>;
  }
  return <PersonTabBody tabId={tabId} personId={personId} isNew={isNew} persons={persons} api={api} onClose={onClose} />;
}

function PersonTabBody({
  tabId,
  personId,
  isNew,
  persons,
  api,
  onClose,
}: {
  tabId: string;
  personId: string;
  isNew: boolean;
  persons: PersonRecord[];
  api: PersonEditorApi;
  onClose: (tabId: string) => void;
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
      current && !current.isNew && previous !== undefined && personDraftMatches(current, previous)
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
      return;
    }
    await api.updatePerson(before, next);
  };

  return (
    <PersonEditor
      draft={draft}
      persons={persons}
      onChange={setDraft}
      onSave={() => void save()}
      onCancel={draft.isNew && !created ? () => onClose(tabId) : undefined}
      api={api}
    />
  );
}

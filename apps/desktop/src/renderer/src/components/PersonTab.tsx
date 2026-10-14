import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (isNew) {
      return;
    }
    const person = persons.find((entry) => entry.id === personId);
    if (!person) {
      return;
    }
    setDraft((current) =>
      current && !current.isNew && personDraftMatches(current, person) ? current : personToDraft(person),
    );
  }, [personId, persons, isNew]);

  const save = async () => {
    const next = draftToRecord(draft);
    if (draft.isNew) {
      await api.addPerson(next);
      onClose(tabId);
      return;
    }
    const before = persons.find((entry) => entry.id === draft.id);
    if (before) {
      await api.updatePerson(before, next);
    }
  };

  return (
    <PersonEditor
      draft={draft}
      persons={persons}
      onChange={setDraft}
      onSave={() => void save()}
      onCancel={draft.isNew ? () => onClose(tabId) : undefined}
      api={api}
    />
  );
}

import { useEffect, useRef, useState } from 'react';
import type { CitationRecord, FamilyRecord, NoteRecord, PersonRecord, SourceRecord } from '@doru/core';
import {
  EntityTab,
  FamilyEditor,
  FamilyInfoList,
  familyDraftMatches,
  familyDraftToRecord,
  familyToDraft,
  type FamilyDraft,
  type FamilyEditorApi,
} from '@doru/features';
import { nls } from '@doru/workbench';
import { FAMILY_TAB_PREFIX } from '../hooks/useTabs';

export function FamilyTab({
  tabId,
  families,
  api,
  persons,
  sources,
  citations,
  notes,
  onClose,
}: {
  tabId: string;
  families: FamilyRecord[];
  api: FamilyEditorApi;
  persons: PersonRecord[];
  sources: SourceRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  onClose: (tabId: string) => void;
}) {
  const familyId = tabId.slice(FAMILY_TAB_PREFIX.length);
  const record = families.find((family) => family.id === familyId);
  if (!record) {
    return <p className="person-missing">{nls.t('features.tree.familyNotFound')}</p>;
  }
  return (
    <FamilyTabBody
      tabId={tabId}
      record={record}
      api={api}
      persons={persons}
      sources={sources}
      citations={citations}
      notes={notes}
      onClose={onClose}
    />
  );
}

function FamilyTabBody({
  tabId,
  record,
  api,
  persons,
  sources,
  citations,
  notes,
  onClose,
}: {
  tabId: string;
  record: FamilyRecord;
  api: FamilyEditorApi;
  persons: PersonRecord[];
  sources: SourceRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  onClose: (tabId: string) => void;
}) {
  const [draft, setDraft] = useState<FamilyDraft>(() => familyToDraft(record));
  const recordRef = useRef(record);

  // Reset the draft only when it still equals the previous stored family —
  // i.e. the user has no unsaved edits. Unrelated tree reloads (a fact
  // added elsewhere) must not clobber in-progress edits.
  useEffect(() => {
    if (record === recordRef.current) {
      return;
    }
    const previous = recordRef.current;
    recordRef.current = record;
    setDraft((current) =>
      current && familyDraftMatches(current, previous) ? familyToDraft(record) : current,
    );
  }, [record]);

  const save = async () => {
    await api.updateFamily(record, familyDraftToRecord(draft));
  };

  const remove = async () => {
    await api.deleteFamily(record);
    onClose(tabId);
  };

  return (
    <EntityTab>
      <FamilyEditor
        draft={draft}
        onChange={setDraft}
        persons={persons}
        api={api}
        onSave={() => void save()}
        onDelete={() => void remove()}
      />
      <FamilyInfoList familyId={record.id} sources={sources} citations={citations} notes={notes} />
    </EntityTab>
  );
}

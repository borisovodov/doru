import { useEffect, useRef, useState } from 'react';
import type {
  CitationRecord,
  FactRecord,
  FamilyRecord,
  NoteRecord,
  PersonRecord,
  RepositoryRecord,
  SourceRecord,
  TitleRecord,
} from '@doru/core';
import {
  EntityTab,
  SourceCitationsList,
  SourceEditor,
  emptySourceDraft,
  sourceDraftMatches,
  sourceDraftToRecord,
  sourceToDraft,
  type SourceDraft,
  type SourceEditorApi,
} from '@doru/features';
import { nls } from '@doru/workbench';
import { SOURCE_TAB_PREFIX } from '../hooks/useTabs';

export function SourceTab({
  tabId,
  sources,
  api,
  persons,
  families,
  facts,
  citations,
  notes,
  onOpenPerson,
  onClose,
}: {
  tabId: string;
  sources: SourceRecord[];
  api: SourceEditorApi;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  onOpenPerson: (personId: string) => void;
  onClose: (tabId: string) => void;
}) {
  const sourceId = tabId.slice(SOURCE_TAB_PREFIX.length);
  const isNew = sourceId.startsWith('new:');
  const record = sources.find((source) => source.id === sourceId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.sources.notFound')}</p>;
  }
  return (
    <SourceTabBody
      tabId={tabId}
      record={record}
      isNew={isNew}
      api={api}
      persons={persons}
      families={families}
      facts={facts}
      citations={citations}
      notes={notes}
      onOpenPerson={onOpenPerson}
      onClose={onClose}
    />
  );
}

function SourceTabBody({
  tabId,
  record,
  isNew,
  api,
  persons,
  families,
  facts,
  citations,
  notes,
  onOpenPerson,
  onClose,
}: {
  tabId: string;
  record: SourceRecord | undefined;
  isNew: boolean;
  api: SourceEditorApi;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  onOpenPerson: (personId: string) => void;
  onClose: (tabId: string) => void;
}) {
  const [draft, setDraft] = useState<SourceDraft>(() =>
    isNew ? emptySourceDraft() : record ? sourceToDraft(record) : emptySourceDraft(),
  );
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [titles, setTitles] = useState<TitleRecord[]>([]);
  const recordRef = useRef(record);

  // Reset the draft only when it still equals the previous stored source —
  // i.e. the user has no unsaved edits. Unrelated tree reloads must not
  // clobber in-progress edits.
  useEffect(() => {
    if (isNew || record === undefined || record === recordRef.current) {
      return;
    }
    const previous = recordRef.current;
    recordRef.current = record;
    setDraft((current) =>
      current && previous !== undefined && sourceDraftMatches(current, previous) ? sourceToDraft(record) : current,
    );
  }, [record, isNew]);

  useEffect(() => {
    let cancelled = false;
    void api.getRepositories().then((loaded) => {
      if (!cancelled) setRepositories(loaded);
    });
    void api.getTitles().then((loaded) => {
      if (!cancelled) setTitles(loaded);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, record]);

  const save = async () => {
    const next = sourceDraftToRecord(draft);
    if (isNew) {
      await api.addSource(next);
      onClose(tabId);
      return;
    }
    if (record) {
      await api.updateSource(record, next);
    }
  };

  const remove = async () => {
    if (record) {
      await api.deleteSource(record);
    }
    onClose(tabId);
  };

  return (
    <EntityTab>
      <SourceEditor
        draft={draft}
        onChange={setDraft}
        repositories={repositories}
        titles={titles}
        onAddRepository={async (repository) => {
          await api.addRepository(repository);
          setRepositories(await api.getRepositories());
        }}
        onSave={() => void save()}
        onDelete={isNew ? undefined : () => void remove()}
      />
      {!isNew && record !== undefined && (
        <SourceCitationsList
          source={record}
        persons={persons}
        families={families}
        facts={facts}
        citations={citations}
        notes={notes}
        onOpenPerson={onOpenPerson}
        />
      )}
    </EntityTab>
  );
}

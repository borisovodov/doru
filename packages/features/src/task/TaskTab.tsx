import { useMemo, useState } from 'react';
import { SectionCard } from '@doru/ui';
import { ListTodo } from 'lucide-react';
import type {
  AddressRecord,
  AssociationRecord,
  CitationRecord,
  FactRecord,
  FamilyRecord,
  MediaRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TitleRecord,
  TodoRecord,
} from '@doru/core';
import { AttachmentsPanel } from '../attachments';
import { EntityTab } from '../sidebar';
import type { TodoEditorApi } from '../person/types';
import {
  TaskEditorFields,
  emptyTodoDraft,
  taskTargetLabel,
  todoDraftToRecord,
  todoToDraft,
  type TodoDraft,
} from '@doru/ui/domain';
import { nls } from '../nls';
import { Button } from '@doru/ui';
import { EntityViewCard } from '@doru/ui';

export function TaskTab({
  entityId,
  todos,
  persons,
  families,
  sources,
  places,
  repositories,
  titles,
  facts,
  citations,
  notes,
  media,
  submitters,
  addresses,
  associations,
  api,
  onClose,
  onOpenMedia,
  onCreated,
}: {
  entityId: string;
  todos: TodoRecord[];
  persons: PersonRecord[];
  families: FamilyRecord[];
  sources: SourceRecord[];
  places: PlaceRecord[];
  repositories: RepositoryRecord[];
  titles: TitleRecord[];
  facts: FactRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  media: MediaRecord[];
  submitters: SubmitterRecord[];
  addresses: AddressRecord[];
  associations: AssociationRecord[];
  api: TodoEditorApi;
  onClose: () => void;
  onOpenMedia: (mediaId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const taskId = entityId;
  const isNew = taskId.startsWith('new:');
  const record = todos.find((todo) => todo.id === taskId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tasks.notFound')}</p>;
  }
  return (
    <TaskTabBody
      record={record}
      isNew={isNew}
      todos={todos}
      persons={persons}
      families={families}
      sources={sources}
      places={places}
      repositories={repositories}
      titles={titles}
      facts={facts}
      citations={citations}
      notes={notes}
      media={media}
      submitters={submitters}
      addresses={addresses}
      associations={associations}
      api={api}
      onClose={onClose}
      onOpenMedia={onOpenMedia}
      onCreated={onCreated}
    />
  );
}

function TaskTabBody({
  record,
  isNew,
  todos,
  persons,
  families,
  sources,
  places,
  repositories,
  titles,
  facts,
  citations,
  notes,
  media,
  submitters,
  addresses,
  associations,
  api,
  onClose,
  onOpenMedia,
  onCreated,
}: {
  record: TodoRecord | undefined;
  isNew: boolean;
  todos: TodoRecord[];
  persons: PersonRecord[];
  families: FamilyRecord[];
  sources: SourceRecord[];
  places: PlaceRecord[];
  repositories: RepositoryRecord[];
  titles: TitleRecord[];
  facts: FactRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  media: MediaRecord[];
  submitters: SubmitterRecord[];
  addresses: AddressRecord[];
  associations: AssociationRecord[];
  api: TodoEditorApi;
  onClose: () => void;
  onOpenMedia: (mediaId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const base = record ?? { id: crypto.randomUUID(), text: '' };
  const [lastSaved, setLastSaved] = useState<TodoRecord | undefined>(record);
  const [draft, setDraft] = useState<TodoDraft>(() => (isNew ? emptyTodoDraft() : todoToDraft(base)));
  const targetId = lastSaved?.id ?? record?.id;

  const repositoryById = new Map(repositories.map((repository) => [repository.id, repository]));
  const patch = (update: Partial<TodoDraft>) => setDraft((current) => ({ ...current, ...update }));

  const targetData = useMemo(
    () => ({
      persons,
      families,
      sources,
      places,
      repositories,
      titles,
      facts,
      citations,
      notes,
      media,
      submitters,
      addresses,
      associations,
      todos,
    }),
    [
      persons,
      families,
      sources,
      places,
      repositories,
      titles,
      facts,
      citations,
      notes,
      media,
      submitters,
      addresses,
      associations,
      todos,
    ],
  );

  const subtitleParts: string[] = [];
  if (draft.category !== '') {
    subtitleParts.push(draft.category);
  }
  if (draft.targetType !== '' && draft.targetId !== '') {
    subtitleParts.push(taskTargetLabel(draft.targetType, draft.targetId, targetData));
  }
  if (draft.repositoryId !== '') {
    const repository = repositoryById.get(draft.repositoryId);
    if (repository) {
      subtitleParts.push(repository.name);
    }
  }

  const save = async () => {
    if (draft.text.trim() === '') {
      return;
    }
    const after = todoDraftToRecord(base, draft);
    if (isNew && lastSaved === undefined) {
      await api.addTodo(after);
      onCreated(after.id);
    } else {
      await api.updateTodo(lastSaved ?? base, after);
    }
    setLastSaved(after);
  };

  const remove = async () => {
    const target = lastSaved ?? base;
    await api.deleteTodo(target);
    onClose();
  };

  return (
    <EntityTab>
      <EntityViewCard
        media={<ListTodo size={20} aria-hidden="true" />}
        title={draft.text.trim() || '—'}
        subtitle={subtitleParts.length > 0 ? subtitleParts.join(' · ') : null}
        actions={
          <>
            <Button variant="primary" size="sm" disabled={draft.text.trim() === ''} onClick={() => void save()}>
              {nls.t('features.tree.save')}
            </Button>
            {(!isNew || lastSaved !== undefined) && (
              <Button variant="danger" size="sm" onClick={() => void remove()}>
                {nls.t('features.tree.fact.delete')}
              </Button>
            )}
          </>
        }
      />

      <SectionCard title={nls.t('features.tree.details')}>
        <TaskEditorFields edit={draft} data={targetData} onChange={patch} />
      </SectionCard>
      {targetId !== undefined && (
        <AttachmentsPanel targetType="todo" targetId={targetId} api={api} sources={sources} onOpenMedia={onOpenMedia} />
      )}
    </EntityTab>
  );
}

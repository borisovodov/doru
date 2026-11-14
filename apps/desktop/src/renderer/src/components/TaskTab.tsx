import { useEffect, useState } from 'react';
import { SectionCard } from '@doru/ui';
import { ListTodo } from 'lucide-react';
import type {
  ChangeRecord,
  FamilyRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  TitleRecord,
  TodoRecord,
} from '@doru/core';
import { EntityTab } from '@doru/features';
import {
  ChangesSection,
  TaskEditorFields,
  displayName,
  emptyTodoDraft,
  familyLabel,
  todoDraftToRecord,
  todoToDraft,
  type TodoDraft,
} from '@doru/ui/domain';
import { placeName } from '@doru/core/model';
import { nls } from '@doru/workbench';
import { Button } from '@doru/ui';
import { EntityViewCard } from '@doru/ui';
import { TASK_TAB_PREFIX } from '../hooks/useTabs';

export function TaskTab({
  tabId,
  todos,
  persons,
  families,
  sources,
  places,
  repositories,
  titles,
  api,
  onClose,
  onCreated,
}: {
  tabId: string;
  todos: TodoRecord[];
  persons: PersonRecord[];
  families: FamilyRecord[];
  sources: SourceRecord[];
  places: PlaceRecord[];
  repositories: RepositoryRecord[];
  titles: TitleRecord[];
  api: {
    getChanges: (targetType: string, targetId: string) => Promise<ChangeRecord[]>;
    addTodo: (todo: TodoRecord) => Promise<void>;
    updateTodo: (before: TodoRecord, after: TodoRecord) => Promise<void>;
    deleteTodo: (todo: TodoRecord) => Promise<void>;
  };
  onClose: (tabId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const taskId = tabId.slice(TASK_TAB_PREFIX.length);
  const isNew = taskId.startsWith('new:');
  const record = todos.find((todo) => todo.id === taskId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tasks.notFound')}</p>;
  }
  return (
    <TaskTabBody
      tabId={tabId}
      record={record}
      isNew={isNew}
      persons={persons}
      families={families}
      sources={sources}
      places={places}
      repositories={repositories}
      titles={titles}
      api={api}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function TaskTabBody({
  tabId,
  record,
  isNew,
  persons,
  families,
  sources,
  places,
  repositories,
  titles,
  api,
  onClose,
  onCreated,
}: {
  tabId: string;
  record: TodoRecord | undefined;
  isNew: boolean;
  persons: PersonRecord[];
  families: FamilyRecord[];
  sources: SourceRecord[];
  places: PlaceRecord[];
  repositories: RepositoryRecord[];
  titles: TitleRecord[];
  api: {
    getChanges: (targetType: string, targetId: string) => Promise<ChangeRecord[]>;
    addTodo: (todo: TodoRecord) => Promise<void>;
    updateTodo: (before: TodoRecord, after: TodoRecord) => Promise<void>;
    deleteTodo: (todo: TodoRecord) => Promise<void>;
  };
  onClose: (tabId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const base = record ?? { id: crypto.randomUUID(), text: '' };
  const [lastSaved, setLastSaved] = useState<TodoRecord | undefined>(record);
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [draft, setDraft] = useState<TodoDraft>(() => (isNew ? emptyTodoDraft() : todoToDraft(base)));

  useEffect(() => {
    let cancelled = false;
    if (!isNew && record !== undefined) {
      void api.getChanges('todo', record.id).then((loaded) => {
        if (!cancelled) setChanges(loaded);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [api, isNew, record]);

  const personById = new Map(persons.map((person) => [person.id, person]));
  const repositoryById = new Map(repositories.map((repository) => [repository.id, repository]));
  const patch = (update: Partial<TodoDraft>) => setDraft((current) => ({ ...current, ...update }));

  const targetLabel = (type: string, id: string): string | undefined => {
    switch (type) {
      case 'person':
        return personById.has(id) ? displayName(personById.get(id)) : id;
      case 'family': {
        const family = families.find((entry) => entry.id === id);
        return family !== undefined ? familyLabel(family, personById) : id;
      }
      case 'source':
        return sources.find((entry) => entry.id === id)?.title ?? id;
      case 'place': {
        const place = places.find((entry) => entry.id === id);
        return place !== undefined ? placeName(place) : id;
      }
      case 'repository':
        return repositoryById.get(id)?.name ?? id;
      case 'title':
        return titles.find((entry) => entry.id === id)?.name ?? id;
      default:
        return `${type}:${id}`;
    }
  };

  const subtitleParts: string[] = [];
  if (draft.category !== '') {
    subtitleParts.push(draft.category);
  }
  if (draft.targetType !== '' && draft.targetId !== '') {
    const label = targetLabel(draft.targetType, draft.targetId);
    if (label !== undefined) {
      subtitleParts.push(label);
    }
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
    onClose(tabId);
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
        <TaskEditorFields
          edit={draft}
          persons={persons}
          families={families}
          sources={sources}
          places={places}
          repositories={repositories}
          titles={titles}
          onChange={patch}
        />
      </SectionCard>
      {!isNew && <ChangesSection changes={changes} />}
    </EntityTab>
  );
}

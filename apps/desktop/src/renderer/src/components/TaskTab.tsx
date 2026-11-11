import { useState } from 'react';
import { ListTodo } from 'lucide-react';
import type { PersonRecord, RepositoryRecord, TodoRecord } from '@doru/core';
import {
  EntityTab,
  TaskEditorFields,
  displayName,
  emptyTodoDraft,
  todoDraftToRecord,
  todoToDraft,
  type TodoDraft,
} from '@doru/features';
import { nls } from '@doru/workbench';
import { TASK_TAB_PREFIX } from '../hooks/useTabs';

export function TaskTab({
  tabId,
  todos,
  persons,
  repositories,
  api,
  onClose,
  onCreated,
}: {
  tabId: string;
  todos: TodoRecord[];
  persons: PersonRecord[];
  repositories: RepositoryRecord[];
  api: {
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
  return <TaskTabBody tabId={tabId} record={record} isNew={isNew} persons={persons} repositories={repositories} api={api} onClose={onClose} onCreated={onCreated} />;
}

function TaskTabBody({
  tabId,
  record,
  isNew,
  persons,
  repositories,
  api,
  onClose,
  onCreated,
}: {
  tabId: string;
  record: TodoRecord | undefined;
  isNew: boolean;
  persons: PersonRecord[];
  repositories: RepositoryRecord[];
  api: {
    addTodo: (todo: TodoRecord) => Promise<void>;
    updateTodo: (before: TodoRecord, after: TodoRecord) => Promise<void>;
    deleteTodo: (todo: TodoRecord) => Promise<void>;
  };
  onClose: (tabId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const base = record ?? { id: crypto.randomUUID(), text: '' };
  const [lastSaved, setLastSaved] = useState<TodoRecord | undefined>(record);
  const [draft, setDraft] = useState<TodoDraft>(() => (isNew ? emptyTodoDraft() : todoToDraft(base)));

  const personById = new Map(persons.map((person) => [person.id, person]));
  const repositoryById = new Map(repositories.map((repository) => [repository.id, repository]));
  const patch = (update: Partial<TodoDraft>) => setDraft((current) => ({ ...current, ...update }));

  const subtitleParts: string[] = [];
  if (draft.category !== '') {
    subtitleParts.push(draft.category);
  }
  if (draft.personId !== '') {
    subtitleParts.push(displayName(personById.get(draft.personId)));
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
      <div className="registry-editor">
        <section className="entity-view-card">
          <span className="entity-card-icon entity-view-icon">
            <ListTodo size={20} aria-hidden="true" />
          </span>
          <div className="entity-view-body">
            <h2 className="entity-view-title">{draft.text.trim() || '—'}</h2>
            {subtitleParts.length > 0 && <p className="entity-view-subtitle">{subtitleParts.join(' · ')}</p>}
          </div>
          <div className="person-view-actions">
            <button className="primary" disabled={draft.text.trim() === ''} onClick={() => void save()}>
              {nls.t('features.tree.save')}
            </button>
            {(!isNew || lastSaved !== undefined) && (
              <button className="registry-delete-button" onClick={() => void remove()}>
                {nls.t('features.tree.fact.delete')}
              </button>
            )}
          </div>
        </section>

        <section className="person-section">
          <h3>{nls.t('features.tree.details')}</h3>
          <div className="task-editor">
            <TaskEditorFields edit={draft} persons={persons} repositories={repositories} onChange={patch} />
          </div>
        </section>
      </div>
    </EntityTab>
  );
}

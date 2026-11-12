import { useState } from 'react';
import { SectionCard } from '@doru/ui';
import { ListTodo } from 'lucide-react';
import type { PersonRecord, RepositoryRecord, TodoRecord } from '@doru/core';
import { EntityTab } from '@doru/features';
import { TaskEditorFields, displayName, emptyTodoDraft, todoDraftToRecord, todoToDraft, type TodoDraft } from '@doru/ui/domain';
import { nls } from '@doru/workbench';
import { Button } from '@doru/ui';
import { EntityViewCard } from '@doru/ui';
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
        <EntityViewCard
          media={<ListTodo size={20} aria-hidden="true" />}
          title={draft.text.trim() || '—'}
          subtitle={subtitleParts.length > 0 ? subtitleParts.join(' · ') : null}
          actions={
            <>
              <Button
                variant="primary"
                size="sm"
                disabled={draft.text.trim() === ''}
                onClick={() => void save()}
              >
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
          <div className="task-editor">
            <TaskEditorFields edit={draft} persons={persons} repositories={repositories} onChange={patch} />
          </div>
        </SectionCard>
      </div>
    </EntityTab>
  );
}

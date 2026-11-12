import { Plus } from 'lucide-react';
import type { PersonRecord, RepositoryRecord, TodoRecord } from '@doru/core';
import { Chip, IconButton, displayName, formatDate } from '@doru/ui';
import { nls } from '../nls';
import './tasks.css';

/**
 * The Tasks sidebar view: the read-only task list. A click opens the task
 * tab; the plus button opens the new-task tab.
 */
export function TasksView({
  todos,
  persons,
  repositories,
  onOpenTask,
  onNewTask,
  onOpenPerson,
}: {
  todos: TodoRecord[];
  persons: PersonRecord[];
  repositories: RepositoryRecord[];
  onOpenTask: (todoId: string) => void;
  onNewTask: () => void;
  onOpenPerson: (personId: string) => void;
}) {
  const personById = new Map(persons.map((person) => [person.id, person]));
  const repositoryById = new Map(repositories.map((repository) => [repository.id, repository]));
  const isClosed = (todo: TodoRecord) => todo.status === 'closed';
  const sorted = [...todos].sort((a, b) => Number(isClosed(a)) - Number(isClosed(b)));

  return (
    <div className="tasks-view">
      <div className="tasks-header">
        <IconButton
          label={nls.t('features.tasks.add')}
          icon={<Plus size={14} aria-hidden="true" />}
          onClick={onNewTask}
        />
      </div>
      {sorted.length === 0 ? (
        <p className="side-registries-note">{nls.t('features.tasks.empty')}</p>
      ) : (
        <ul className="task-list">
          {sorted.map((todo) => (
            <li key={todo.id} className="task-item">
              <div className="task-row" onClick={() => onOpenTask(todo.id)}>
                <span className="task-row-body">
                  <span className={isClosed(todo) ? 'task-row-text closed' : 'task-row-text'}>{todo.text}</span>
                  <span className="task-row-meta">
                    {todo.priority !== undefined && (
                      <Chip variant="neutral">
                        {todo.priority === 'low'
                          ? nls.t('features.tasks.priorityLow')
                          : todo.priority === 'medium'
                            ? nls.t('features.tasks.priorityMedium')
                            : todo.priority === 'high'
                              ? nls.t('features.tasks.priorityHigh')
                              : todo.priority}
                      </Chip>
                    )}
                    {todo.category !== undefined && <Chip variant="neutral">{todo.category}</Chip>}
                    {todo.scheduledDate !== undefined && (
                      <Chip variant="neutral">{formatDate(todo.scheduledDate)}</Chip>
                    )}
                    {todo.repositoryId !== undefined && repositoryById.has(todo.repositoryId) && (
                      <Chip variant="neutral">{repositoryById.get(todo.repositoryId)?.name}</Chip>
                    )}
                    {todo.targetType === 'person' && todo.targetId !== undefined && personById.has(todo.targetId) && (
                      <button
                        className="task-chip task-chip-link"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenPerson(todo.targetId as string);
                        }}
                      >
                        {displayName(personById.get(todo.targetId as string))}
                      </button>
                    )}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

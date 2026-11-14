import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { TodoRecord } from '@doru/core';
import { Button } from '../../atoms/button/Button';
import { Chip } from '../../atoms/display/Chip';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Input } from '../../atoms/form/Input';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import { nls } from '../../nls';
import { formatDate } from '../format/format';
import './TasksSection.css';

/** The task operations an entity editor needs for one target. */
export interface TasksSectionApi {
  getTodosFor(targetType: string, targetId: string): Promise<TodoRecord[]>;
  addTodo(todo: TodoRecord): Promise<void>;
  deleteTodo(todo: TodoRecord): Promise<void>;
  openTask?: ((todoId: string) => void) | undefined;
}

/**
 * The tasks attached to one record, with inline creation. The row opens the
 * full task tab when the host wires `openTask`; free-standing tasks stay in
 * the global Tasks view.
 */
export function TasksSection({
  targetType,
  targetId,
  api,
}: {
  targetType: string;
  targetId: string;
  api: TasksSectionApi;
}) {
  const [todos, setTodos] = useState<TodoRecord[]>([]);
  const [draft, setDraft] = useState('');

  const reload = useCallback(async () => {
    setTodos(await api.getTodosFor(targetType, targetId));
  }, [api, targetType, targetId]);

  useEffect(() => {
    let cancelled = false;
    void api.getTodosFor(targetType, targetId).then((loaded) => {
      if (!cancelled) {
        setTodos(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api, targetType, targetId]);

  const add = async () => {
    const text = draft.trim();
    if (text === '') {
      return;
    }
    await api.addTodo({ id: crypto.randomUUID(), text, targetType, targetId });
    setDraft('');
    await reload();
  };

  const remove = async (todo: TodoRecord) => {
    await api.deleteTodo(todo);
    await reload();
  };

  const sorted = [...todos].sort((a, b) => Number(a.status === 'closed') - Number(b.status === 'closed'));

  return (
    <SectionCard title={nls.t('features.tasks.title')}>
      {sorted.length === 0 && <EmptyText>{nls.t('features.tasks.empty')}</EmptyText>}
      <ul className="tasks-section-list">
        {sorted.map((todo) => (
          <li key={todo.id} className="tasks-section-item">
            <div className="tasks-section-row">
              <button
                type="button"
                className="tasks-section-open"
                aria-label={nls.t('features.tasks.open')}
                disabled={api.openTask === undefined}
                onClick={() => api.openTask?.(todo.id)}
              >
                <span className={todo.status === 'closed' ? 'tasks-section-text closed' : 'tasks-section-text'}>
                  {todo.text}
                </span>
                <span className="tasks-section-meta">
                  <Chip variant="neutral">{statusLabel(todo.status)}</Chip>
                  {todo.priority !== undefined && <Chip variant="neutral">{priorityLabel(todo.priority)}</Chip>}
                  {todo.category !== undefined && <Chip variant="neutral">{todo.category}</Chip>}
                  {todo.scheduledDate !== undefined && <Chip variant="neutral">{formatDate(todo.scheduledDate)}</Chip>}
                </span>
              </button>
              <IconButton
                size="sm"
                label={nls.t('features.tasks.delete')}
                icon={<X size={13} aria-hidden="true" />}
                onClick={() => void remove(todo)}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="tasks-section-add">
        <Input
          value={draft}
          placeholder={nls.t('features.tasks.newTask')}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void add();
            }
          }}
        />
        <Button variant="primary" onClick={() => void add()}>
          {nls.t('features.tasks.add')}
        </Button>
      </div>
    </SectionCard>
  );
}

function statusLabel(status: string | undefined): string {
  if (status === 'closed') {
    return nls.t('features.tasks.statusClosed');
  }
  if (status === 'in-progress') {
    return nls.t('features.tasks.statusInProgress');
  }
  return nls.t('features.tasks.statusOpen');
}

function priorityLabel(priority: string): string {
  if (priority === 'low') {
    return nls.t('features.tasks.priorityLow');
  }
  if (priority === 'medium') {
    return nls.t('features.tasks.priorityMedium');
  }
  if (priority === 'high') {
    return nls.t('features.tasks.priorityHigh');
  }
  return priority;
}

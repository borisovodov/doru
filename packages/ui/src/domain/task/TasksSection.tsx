import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { TaskRecord } from '@doru/core';
import { normalizeTaskPriority, normalizeTaskStatus } from '@doru/core/model';
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
  getTasksFor(targetType: string, targetId: string): Promise<TaskRecord[]>;
  addTask(task: TaskRecord): Promise<void>;
  deleteTask(task: TaskRecord): Promise<void>;
  openTask?: ((taskId: string) => void) | undefined;
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
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [draft, setDraft] = useState('');

  const reload = useCallback(async () => {
    setTasks(await api.getTasksFor(targetType, targetId));
  }, [api, targetType, targetId]);

  useEffect(() => {
    let cancelled = false;
    void api.getTasksFor(targetType, targetId).then((loaded) => {
      if (!cancelled) {
        setTasks(loaded);
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
    await api.addTask({
      id: crypto.randomUUID(),
      text,
      targetType,
      targetId,
      status: 'open',
      priority: 'medium',
    });
    setDraft('');
    await reload();
  };

  const remove = async (task: TaskRecord) => {
    await api.deleteTask(task);
    await reload();
  };

  const sorted = [...tasks].sort(
    (a, b) => Number(normalizeTaskStatus(a.status) === 'closed') - Number(normalizeTaskStatus(b.status) === 'closed'),
  );

  return (
    <SectionCard title={nls.t('features.tasks.title')}>
      {sorted.length === 0 && <EmptyText>{nls.t('features.tasks.empty')}</EmptyText>}
      <ul className="tasks-section-list">
        {sorted.map((task) => (
          <li key={task.id} className="tasks-section-item">
            <div className="tasks-section-row">
              <button
                type="button"
                className="tasks-section-open"
                aria-label={nls.t('features.tasks.open')}
                disabled={api.openTask === undefined}
                onClick={() => api.openTask?.(task.id)}
              >
                <span className={task.status === 'closed' ? 'tasks-section-text closed' : 'tasks-section-text'}>
                  {task.text}
                </span>
                <span className="tasks-section-meta">
                  <Chip variant="neutral">{statusLabel(task.status)}</Chip>
                  <Chip variant="neutral">{priorityLabel(task.priority)}</Chip>
                  {task.scheduledDate !== undefined && <Chip variant="neutral">{formatDate(task.scheduledDate)}</Chip>}
                </span>
              </button>
              <IconButton
                size="sm"
                label={nls.t('features.tasks.delete')}
                icon={<X size={13} aria-hidden="true" />}
                onClick={() => void remove(task)}
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
  const canonical = normalizeTaskStatus(status);
  if (canonical === 'closed') {
    return nls.t('features.tasks.statusClosed');
  }
  if (canonical === 'waiting') {
    return nls.t('features.tasks.statusWaiting');
  }
  if (canonical === 'in-progress') {
    return nls.t('features.tasks.statusInProgress');
  }
  return nls.t('features.tasks.statusOpen');
}

function priorityLabel(priority: string | undefined): string {
  const canonical = normalizeTaskPriority(priority);
  if (canonical === 'low') {
    return nls.t('features.tasks.priorityLow');
  }
  if (canonical === 'high') {
    return nls.t('features.tasks.priorityHigh');
  }
  return nls.t('features.tasks.priorityMedium');
}

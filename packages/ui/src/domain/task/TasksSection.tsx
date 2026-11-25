import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { TaskRecord, TaskTargetLink } from '@doru/core';
import { normalizeTaskPriority, normalizeTaskStatus } from '@doru/core/model';
import { Button } from '../../atoms/button/Button';
import { Chip } from '../../atoms/display/Chip';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { InlineError } from '../../atoms/feedback/InlineError';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Input } from '../../atoms/form/Input';
import { AttachExisting } from '../../patterns/attach-existing/AttachExisting';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import { nls } from '../../nls';
import { formatTimestamp } from '../format/format';
import { TASK_TARGET_TYPES } from './taskTargets';
import './TasksSection.css';

/** The task operations an entity editor needs for one target. */
export interface TasksSectionApi {
  getTasksFor(targetType: string, targetId: string): Promise<TaskRecord[]>;
  getAllTasks(): Promise<TaskRecord[]>;
  addTask(task: TaskRecord): Promise<void>;
  addTaskLink(link: TaskTargetLink): Promise<void>;
  deleteTaskLink(link: TaskTargetLink): Promise<void>;
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
  const canAdd = (TASK_TARGET_TYPES as readonly string[]).includes(targetType);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [allTasks, setAllTasks] = useState<TaskRecord[]>([]);
  const [draft, setDraft] = useState('');
  const [actionError, setActionError] = useState(false);

  const load = useCallback(async () => {
    const [loadedTasks, loadedAllTasks] = await Promise.all([
      api.getTasksFor(targetType, targetId),
      canAdd ? api.getAllTasks().catch(() => [] as TaskRecord[]) : Promise.resolve([] as TaskRecord[]),
    ]);
    return { tasks: loadedTasks, allTasks: loadedAllTasks };
  }, [api, canAdd, targetType, targetId]);

  useEffect(() => {
    let cancelled = false;
    void load().then((loaded) => {
      if (!cancelled) {
        setTasks(loaded.tasks);
        setAllTasks(loaded.allTasks);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const reload = useCallback(async () => {
    const loaded = await load();
    setTasks(loaded.tasks);
    setAllTasks(loaded.allTasks);
  }, [load]);

  const add = async () => {
    const text = draft.trim();
    if (text === '') {
      return;
    }
    setActionError(false);
    const id = crypto.randomUUID();
    try {
      await api.addTask({
        id,
        text,
        targets: [{ id: crypto.randomUUID(), taskId: id, targetType, targetId }],
        status: 'open',
        priority: 'medium',
      });
      setDraft('');
      await reload();
    } catch {
      setActionError(true);
    }
  };

  const attach = async (taskId: string) => {
    setActionError(false);
    try {
      await api.addTaskLink({ id: crypto.randomUUID(), taskId, targetType, targetId });
      await reload();
    } catch (error) {
      setActionError(true);
      throw error;
    }
  };

  const remove = async (task: TaskRecord) => {
    const link = task.targets.find((entry) => entry.targetType === targetType && entry.targetId === targetId);
    if (link === undefined) {
      return;
    }
    setActionError(false);
    try {
      await api.deleteTaskLink(link);
      await reload();
    } catch {
      setActionError(true);
    }
  };

  const sorted = [...tasks].sort(
    (a, b) => Number(normalizeTaskStatus(a.status) === 'closed') - Number(normalizeTaskStatus(b.status) === 'closed'),
  );
  const linkedIds = new Set(tasks.map((task) => task.id));
  const attachable = allTasks
    .filter((task) => !linkedIds.has(task.id))
    .sort(
      (a, b) => Number(normalizeTaskStatus(a.status) === 'closed') - Number(normalizeTaskStatus(b.status) === 'closed'),
    );
  // Sources and tasks cannot gain child tasks; legacy links stay visible.
  if (!canAdd && sorted.length === 0) {
    return null;
  }

  return (
    <SectionCard title={nls.t('features.tasks.title')}>
      {sorted.length === 0 && <EmptyText>{nls.t('features.tasks.empty')}</EmptyText>}
      {actionError ? <InlineError>{nls.t('features.tree.autosaveFailed')}</InlineError> : null}
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
                  {task.remindAt !== undefined && <Chip variant="neutral">{formatTimestamp(task.remindAt)}</Chip>}
                </span>
              </button>
              <IconButton
                size="sm"
                label={nls.t('features.tasks.remove')}
                icon={<X size={13} aria-hidden="true" />}
                onClick={() => void remove(task)}
              />
            </div>
          </li>
        ))}
      </ul>
      {canAdd && (
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
          <Button variant="secondary" onClick={() => void add()}>
            {nls.t('features.tasks.add')}
          </Button>
        </div>
      )}
      {canAdd && (
        <AttachExisting
          label={nls.t('features.tasks.attachExisting')}
          actionLabel={nls.t('features.tasks.attach')}
          options={attachable.map((task) => ({
            id: task.id,
            label: task.text.length > 60 ? `${task.text.slice(0, 60)}…` : task.text,
          }))}
          onAttach={attach}
        />
      )}
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

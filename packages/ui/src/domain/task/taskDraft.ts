import type { TaskPriority, TaskRecord, TaskStatus } from '@doru/core';
import { normalizeTaskPriority, normalizeTaskStatus } from '@doru/core/model';
import { inputToTimestamp, timestampToInput } from '../../lib/datetime';

export { inputToTimestamp, timestampToInput } from '../../lib/datetime';

/** The editable form of a task; empty strings mean "not set". */
export interface TaskDraft {
  text: string;
  priority: TaskPriority;
  status: TaskStatus;
  /** Local `datetime-local` value, e.g. `2026-11-22T18:30`. */
  scheduledAt: string;
  /** Local `datetime-local` value. */
  reminderAt: string;
}

export function emptyTaskDraft(): TaskDraft {
  return {
    text: '',
    priority: 'medium',
    status: 'open',
    scheduledAt: '',
    reminderAt: '',
  };
}

export function taskToDraft(task: TaskRecord): TaskDraft {
  return {
    text: task.text,
    priority: normalizeTaskPriority(task.priority),
    status: normalizeTaskStatus(task.status),
    scheduledAt: timestampToInput(task.scheduledAt),
    reminderAt: timestampToInput(task.reminderAt),
  };
}

/** True when a nonempty draft value is not a real local instant. */
export function taskDraftHasInvalidTimestamp(draft: TaskDraft): boolean {
  return [draft.scheduledAt, draft.reminderAt].some(
    (value) => value.trim() !== '' && inputToTimestamp(value) === undefined,
  );
}

export function taskDraftToRecord(task: TaskRecord, draft: TaskDraft): TaskRecord {
  const next: TaskRecord = { ...task };
  next.text = draft.text.trim();
  next.priority = normalizeTaskPriority(draft.priority);
  next.status = normalizeTaskStatus(draft.status);
  next.scheduledAt = preserveTimestamp(task.scheduledAt, draft.scheduledAt);
  next.reminderAt = preserveTimestamp(task.reminderAt, draft.reminderAt);
  return next;
}

/**
 * The minute-precision input cannot represent seconds, milliseconds or the
 * second occurrence of a repeated local time. Keep the stored instant when the
 * draft still shows exactly that instant; parse only a changed value.
 */
function preserveTimestamp(original: number | undefined, input: string): number | undefined {
  if (original !== undefined && input === timestampToInput(original)) {
    return original;
  }
  return inputToTimestamp(input);
}

/** Keeps locally edited task fields while adopting refreshed untouched values. */
export function mergeTaskDraft(current: TaskDraft, base: TaskDraft, refreshed: TaskDraft): TaskDraft {
  const field = <K extends keyof TaskDraft>(key: K): TaskDraft[K] =>
    current[key] === base[key] ? refreshed[key] : current[key];
  return {
    text: field('text'),
    priority: field('priority'),
    status: field('status'),
    scheduledAt: field('scheduledAt'),
    reminderAt: field('reminderAt'),
  };
}

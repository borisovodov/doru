import type { TaskPriority, TaskRecord, TaskStatus } from '@doru/core';
import { normalizeTaskPriority, normalizeTaskStatus } from '@doru/core/model';

/** The editable form of a task; empty strings mean "not set". */
export interface TaskDraft {
  text: string;
  priority: TaskPriority;
  status: TaskStatus;
  /** Local `datetime-local` value, e.g. `2026-11-22T18:30`. */
  scheduledAt: string;
  /** Local `datetime-local` value. */
  reminderAt: string;
  targetType: string;
  targetId: string;
}

export function emptyTaskDraft(): TaskDraft {
  return {
    text: '',
    priority: 'medium',
    status: 'open',
    scheduledAt: '',
    reminderAt: '',
    targetType: '',
    targetId: '',
  };
}

export function taskToDraft(task: TaskRecord): TaskDraft {
  return {
    text: task.text,
    priority: normalizeTaskPriority(task.priority),
    status: normalizeTaskStatus(task.status),
    scheduledAt: timestampToInput(task.scheduledAt),
    reminderAt: timestampToInput(task.reminderAt),
    targetType: task.targetType ?? '',
    targetId: task.targetId ?? '',
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
  if (draft.targetType !== '' && draft.targetId !== '') {
    next.targetType = draft.targetType;
    next.targetId = draft.targetId;
  } else {
    next.targetType = undefined;
    next.targetId = undefined;
  }
  return next;
}

/** Converts an epoch-ms instant to the local value a `datetime-local` input expects. */
export function timestampToInput(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  if (year < 0 || year > 9999) {
    return '';
  }
  const pad = (part: number, size = 2): string => String(part).padStart(size, '0');
  return `${pad(year, 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parses a `datetime-local` value as a local instant; invalid values mean "not set". */
export function inputToTimestamp(value: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (match === null) {
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] !== undefined ? Number(match[6]) : 0;
  // Years 0-99 must not turn into 1900-1999 in the Date constructor.
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(hour, minute, second, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return undefined;
  }
  return date.getTime();
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

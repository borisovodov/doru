import type { TaskPriority, TaskRecord, TaskStatus } from '@doru/core';
import { normalizeTaskPriority, normalizeTaskStatus } from '@doru/core/model';
import { emptyDate, fromDateDraft, toDateDraft, type DateDraft } from '../person/draft';

/** The editable form of a task; empty strings mean "not set". */
export interface TaskDraft {
  text: string;
  priority: TaskPriority;
  status: TaskStatus;
  created: DateDraft;
  scheduled: DateDraft;
  reminder: DateDraft;
  closed: DateDraft;
  targetType: string;
  targetId: string;
}

export function emptyTaskDraft(): TaskDraft {
  return {
    text: '',
    priority: 'medium',
    status: 'open',
    created: emptyDate(),
    scheduled: emptyDate(),
    reminder: emptyDate(),
    closed: emptyDate(),
    targetType: '',
    targetId: '',
  };
}

export function taskToDraft(task: TaskRecord): TaskDraft {
  return {
    text: task.text,
    priority: normalizeTaskPriority(task.priority),
    status: normalizeTaskStatus(task.status),
    created: toDateDraft(task.createdDate),
    scheduled: toDateDraft(task.scheduledDate),
    reminder: toDateDraft(task.reminderDate),
    closed: toDateDraft(task.closedDate),
    targetType: task.targetType ?? '',
    targetId: task.targetId ?? '',
  };
}

export function taskDraftToRecord(task: TaskRecord, draft: TaskDraft): TaskRecord {
  const next: TaskRecord = { ...task };
  next.text = draft.text.trim();
  next.priority = normalizeTaskPriority(draft.priority);
  next.status = normalizeTaskStatus(draft.status);
  next.createdDate = fromDateDraft(draft.created, task.createdDate);
  next.scheduledDate = fromDateDraft(draft.scheduled, task.scheduledDate);
  next.reminderDate = fromDateDraft(draft.reminder, task.reminderDate);
  next.closedDate = fromDateDraft(draft.closed, task.closedDate);
  if (draft.targetType !== '' && draft.targetId !== '') {
    next.targetType = draft.targetType;
    next.targetId = draft.targetId;
  } else {
    next.targetType = undefined;
    next.targetId = undefined;
  }
  return next;
}

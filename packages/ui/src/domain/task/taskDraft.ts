import type { TaskRecord } from '@doru/core';
import { emptyDate, fromDateDraft, toDateDraft, type DateDraft } from '../person/draft';

/** The editable form of a task; `''` means "not set". */
export interface TaskDraft {
  text: string;
  category: string;
  locality: string;
  priority: string;
  status: string;
  created: DateDraft;
  scheduled: DateDraft;
  reminder: DateDraft;
  closed: DateDraft;
  repositoryId: string;
  targetType: string;
  targetId: string;
}

export function emptyTaskDraft(): TaskDraft {
  return {
    text: '',
    category: '',
    locality: '',
    priority: '',
    status: '',
    created: emptyDate(),
    scheduled: emptyDate(),
    reminder: emptyDate(),
    closed: emptyDate(),
    repositoryId: '',
    targetType: '',
    targetId: '',
  };
}

export function taskToDraft(task: TaskRecord): TaskDraft {
  return {
    text: task.text,
    category: task.category ?? '',
    locality: task.locality ?? '',
    priority: task.priority ?? '',
    status: task.status ?? '',
    created: toDateDraft(task.createdDate),
    scheduled: toDateDraft(task.scheduledDate),
    reminder: toDateDraft(task.reminderDate),
    closed: toDateDraft(task.closedDate),
    repositoryId: task.repositoryId ?? '',
    targetType: task.targetType ?? '',
    targetId: task.targetId ?? '',
  };
}

export function taskDraftToRecord(task: TaskRecord, draft: TaskDraft): TaskRecord {
  const next: TaskRecord = { ...task };
  next.text = draft.text.trim();
  next.category = draft.category.trim() || undefined;
  next.locality = draft.locality.trim() || undefined;
  next.priority = draft.priority || undefined;
  next.status = draft.status || undefined;
  next.createdDate = fromDateDraft(draft.created, task.createdDate);
  next.scheduledDate = fromDateDraft(draft.scheduled, task.scheduledDate);
  next.reminderDate = fromDateDraft(draft.reminder, task.reminderDate);
  next.closedDate = fromDateDraft(draft.closed, task.closedDate);
  next.repositoryId = draft.repositoryId || undefined;
  if (draft.targetType !== '' && draft.targetId !== '') {
    next.targetType = draft.targetType;
    next.targetId = draft.targetId;
  } else {
    next.targetType = undefined;
    next.targetId = undefined;
  }
  return next;
}

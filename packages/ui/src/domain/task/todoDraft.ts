import type { TodoRecord } from '@doru/core';
import { emptyDate, fromDateDraft, toDateDraft, type DateDraft } from '../person/draft';

/** The editable form of a todo; `''` means "not set". */
export interface TodoDraft {
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

export function emptyTodoDraft(): TodoDraft {
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

export function todoToDraft(todo: TodoRecord): TodoDraft {
  return {
    text: todo.text,
    category: todo.category ?? '',
    locality: todo.locality ?? '',
    priority: todo.priority ?? '',
    status: todo.status ?? '',
    created: toDateDraft(todo.createdDate),
    scheduled: toDateDraft(todo.scheduledDate),
    reminder: toDateDraft(todo.reminderDate),
    closed: toDateDraft(todo.closedDate),
    repositoryId: todo.repositoryId ?? '',
    targetType: todo.targetType ?? '',
    targetId: todo.targetId ?? '',
  };
}

export function todoDraftToRecord(todo: TodoRecord, draft: TodoDraft): TodoRecord {
  const next: TodoRecord = { ...todo };
  next.text = draft.text.trim();
  next.category = draft.category.trim() || undefined;
  next.locality = draft.locality.trim() || undefined;
  next.priority = draft.priority || undefined;
  next.status = draft.status || undefined;
  next.createdDate = fromDateDraft(draft.created);
  next.scheduledDate = fromDateDraft(draft.scheduled);
  next.reminderDate = fromDateDraft(draft.reminder);
  next.closedDate = fromDateDraft(draft.closed);
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

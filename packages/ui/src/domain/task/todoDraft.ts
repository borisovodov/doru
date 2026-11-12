import type { TodoRecord } from '@doru/core';
import { emptyDate, fromDateDraft, toDateDraft, type DateDraft } from '../person/draft';

/** The editable form of a todo; `''` means "not set". */
export interface TodoDraft {
  text: string;
  category: string;
  locality: string;
  priority: string;
  status: string;
  scheduled: DateDraft;
  reminder: DateDraft;
  repositoryId: string;
  personId: string;
}

export function emptyTodoDraft(): TodoDraft {
  return {
    text: '',
    category: '',
    locality: '',
    priority: '',
    status: '',
    scheduled: emptyDate(),
    reminder: emptyDate(),
    repositoryId: '',
    personId: '',
  };
}

export function todoToDraft(todo: TodoRecord): TodoDraft {
  return {
    text: todo.text,
    category: todo.category ?? '',
    locality: todo.locality ?? '',
    priority: todo.priority ?? '',
    status: todo.status ?? '',
    scheduled: toDateDraft(todo.scheduledDate),
    reminder: toDateDraft(todo.reminderDate),
    repositoryId: todo.repositoryId ?? '',
    personId: todo.targetType === 'person' ? (todo.targetId ?? '') : '',
  };
}

export function todoDraftToRecord(todo: TodoRecord, draft: TodoDraft): TodoRecord {
  const next: TodoRecord = { ...todo };
  next.text = draft.text.trim();
  next.category = draft.category.trim() || undefined;
  next.locality = draft.locality.trim() || undefined;
  next.priority = draft.priority || undefined;
  next.status = draft.status || undefined;
  next.scheduledDate = fromDateDraft(draft.scheduled);
  next.reminderDate = fromDateDraft(draft.reminder);
  next.repositoryId = draft.repositoryId || undefined;
  if (draft.personId !== '') {
    next.targetType = 'person';
    next.targetId = draft.personId;
  } else {
    next.targetType = undefined;
    next.targetId = undefined;
  }
  return next;
}

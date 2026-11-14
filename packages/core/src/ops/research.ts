import type { AssociationRecord, AttachmentsSnapshot, TitleRecord, TodoRecord } from '../model/types';
import { emptyAttachments } from '../model/types';
import type { Op } from './op';

function op(id: string, kind: string, apply: Op['apply'], inverse: Op['inverse'], change?: Op['change']): Op {
  return { id, kind, timestamp: new Date().toISOString(), ...(change ? { change } : {}), apply, inverse };
}

export function addAssociationOp(association: AssociationRecord): Op {
  return op(
    crypto.randomUUID(),
    'association.add',
    (ctx) => ctx.repo.insertAssociation(association),
    (ctx) => ctx.repo.deleteAssociation(association.id),
    { targetType: 'association', targetId: association.id, kind: 'created' },
  );
}

export function updateAssociationOp(before: AssociationRecord, after: AssociationRecord): Op {
  return op(
    crypto.randomUUID(),
    'association.update',
    (ctx) => ctx.repo.updateAssociation(after),
    (ctx) => ctx.repo.updateAssociation(before),
    { targetType: 'association', targetId: before.id, kind: 'changed' },
  );
}

export function deleteAssociationOp(
  association: AssociationRecord,
  attachments: AttachmentsSnapshot = emptyAttachments(),
): Op {
  return op(
    crypto.randomUUID(),
    'association.delete',
    (ctx) => ctx.repo.deleteAssociation(association.id),
    (ctx) => {
      ctx.repo.insertAssociation(association);
      ctx.repo.restoreAttachments(attachments);
    },
  );
}

export function addAliasOp(id: string, personId: string, aliasId: string): Op {
  return op(
    crypto.randomUUID(),
    'alias.add',
    (ctx) => ctx.repo.insertAlias(id, personId, aliasId),
    (ctx) => ctx.repo.deleteAlias(id),
    { targetType: 'person', targetId: personId, kind: 'changed' },
  );
}

export function deleteAliasOp(id: string, personId: string, aliasId: string): Op {
  return op(
    crypto.randomUUID(),
    'alias.delete',
    (ctx) => ctx.repo.deleteAlias(id),
    (ctx) => ctx.repo.insertAlias(id, personId, aliasId),
  );
}

export function addTodoOp(todo: TodoRecord): Op {
  return op(
    crypto.randomUUID(),
    'todo.add',
    (ctx) => ctx.repo.insertTodo(todo),
    (ctx) => ctx.repo.deleteTodo(todo.id),
    { targetType: 'todo', targetId: todo.id, kind: 'created' },
  );
}

export function updateTodoOp(before: TodoRecord, after: TodoRecord): Op {
  return op(
    crypto.randomUUID(),
    'todo.update',
    (ctx) => ctx.repo.updateTodo(after),
    (ctx) => ctx.repo.updateTodo(before),
    { targetType: 'todo', targetId: before.id, kind: 'changed' },
  );
}

export function deleteTodoOp(todo: TodoRecord, attachments: AttachmentsSnapshot = emptyAttachments()): Op {
  return op(
    crypto.randomUUID(),
    'todo.delete',
    (ctx) => ctx.repo.deleteTodo(todo.id),
    (ctx) => {
      ctx.repo.insertTodo(todo);
      ctx.repo.restoreAttachments(attachments);
    },
    { targetType: 'todo', targetId: todo.id, kind: 'changed' },
  );
}

export function addTitleOp(title: TitleRecord): Op {
  return op(
    crypto.randomUUID(),
    'title.add',
    (ctx) => ctx.repo.insertTitle(title),
    (ctx) => ctx.repo.deleteTitle(title.id),
    { targetType: 'title', targetId: title.id, kind: 'created' },
  );
}

export function updateTitleOp(before: TitleRecord, after: TitleRecord): Op {
  return op(
    crypto.randomUUID(),
    'title.update',
    (ctx) => ctx.repo.updateTitle(after),
    (ctx) => ctx.repo.updateTitle(before),
    { targetType: 'title', targetId: before.id, kind: 'changed' },
  );
}

export function deleteTitleOp(title: TitleRecord, attachments: AttachmentsSnapshot = emptyAttachments()): Op {
  return op(
    crypto.randomUUID(),
    'title.delete',
    (ctx) => ctx.repo.deleteTitle(title.id),
    (ctx) => {
      ctx.repo.insertTitle(title);
      ctx.repo.restoreAttachments(attachments);
    },
    { targetType: 'title', targetId: title.id, kind: 'changed' },
  );
}

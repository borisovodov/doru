import type { AssociationRecord, AttachmentsSnapshot, TitleRecord, TodoRecord } from '../model/types';
import { emptyAttachments } from '../model/types';
import type { Op } from './op';
import { attachmentsMatch, restoreAlias, restoreAssociation, restoreTitle, restoreTodo, sameRecord } from './restore';

function op(
  id: string,
  kind: string,
  apply: Op['apply'],
  inverse: Op['inverse'],
  change?: Op['change'],
  redoSafe?: NonNullable<Op['redoSafe']>,
): Op {
  return {
    id,
    kind,
    timestamp: new Date().toISOString(),
    ...(change ? { change } : {}),
    ...(redoSafe ? { redoSafe } : {}),
    apply,
    inverse,
  };
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
    (ctx) => {
      const current = ctx.repo.listAssociations().find((entry) => entry.id === before.id);
      if (current === undefined || !sameRecord(current, before)) {
        return false;
      }
      if (ctx.repo.getPerson(after.otherPersonId) === undefined) {
        return false;
      }
      if (
        (after.personId !== undefined && ctx.repo.getPerson(after.personId) === undefined) ||
        (after.familyId !== undefined && ctx.repo.getFamily(after.familyId) === undefined)
      ) {
        return false;
      }
      return true;
    },
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
      if (restoreAssociation(ctx, association)) {
        ctx.repo.restoreAttachments(attachments);
      }
    },
    { targetType: 'association', targetId: association.id, kind: 'changed' },
    (ctx) => {
      const current =
        association.personId !== undefined
          ? ctx.repo.listAssociationsFor(association.personId).find((entry) => entry.id === association.id)
          : association.familyId !== undefined
            ? ctx.repo.listAssociationsForFamily(association.familyId).find((entry) => entry.id === association.id)
            : undefined;
      return (
        current !== undefined &&
        sameRecord(current, association) &&
        attachmentsMatch(ctx, 'association', association.id, attachments)
      );
    },
  );
}

export function addAliasOp(id: string, personId: string, aliasId: string): Op {
  return op(
    crypto.randomUUID(),
    'alias.add',
    (ctx) => {
      if (!restoreAlias(ctx, id, personId, aliasId)) {
        throw new Error(`cannot add alias ${id}: person ${personId} or ${aliasId} no longer exists`);
      }
    },
    (ctx) => ctx.repo.deleteAlias(id),
    { targetType: 'person', targetId: personId, kind: 'changed' },
    (ctx) => ctx.repo.getPerson(personId) !== undefined && ctx.repo.getPerson(aliasId) !== undefined,
  );
}

export function deleteAliasOp(id: string, personId: string, aliasId: string): Op {
  return op(
    crypto.randomUUID(),
    'alias.delete',
    (ctx) => ctx.repo.deleteAlias(id),
    (ctx) => ctx.repo.insertAlias(id, personId, aliasId),
    { targetType: 'person', targetId: personId, kind: 'changed' },
    (ctx) =>
      ctx.repo.getPerson(personId) !== undefined &&
      ctx.repo.getPerson(aliasId) !== undefined &&
      ctx.repo.listAliasRowsFor(personId).some((row) => row.id === id),
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
  let baseline = todo;
  return op(
    crypto.randomUUID(),
    'todo.delete',
    (ctx) => ctx.repo.deleteTodo(todo.id),
    (ctx) => {
      restoreTodo(ctx, todo);
      baseline = ctx.repo.getTodo(todo.id) ?? todo;
      ctx.repo.restoreAttachments(attachments);
    },
    { targetType: 'todo', targetId: todo.id, kind: 'changed' },
    (ctx) =>
      ctx.repo.getTodo(todo.id) !== undefined &&
      sameRecord(ctx.repo.getTodo(todo.id), baseline) &&
      attachmentsMatch(ctx, 'todo', todo.id, attachments),
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
    (ctx) => ctx.repo.getTitle(before.id) !== undefined,
  );
}

/** Sources whose `title_id` FK is nulled by the title delete. */
export interface TitleConsumers {
  sources?: Array<{ id: string; titleId: string }>;
}

export function deleteTitleOp(
  title: TitleRecord,
  attachments: AttachmentsSnapshot = emptyAttachments(),
  consumers: TitleConsumers = {},
): Op {
  let baseline = title;
  return op(
    crypto.randomUUID(),
    'title.delete',
    (ctx) => ctx.repo.deleteTitle(title.id),
    (ctx) => {
      restoreTitle(ctx, title);
      baseline = ctx.repo.getTitle(title.id) ?? title;
      ctx.repo.restoreAttachments(attachments);
      for (const source of consumers.sources ?? []) {
        ctx.repo.setSourceTitle(source.id, source.titleId);
      }
    },
    { targetType: 'title', targetId: title.id, kind: 'changed' },
    (ctx) => {
      if (
        ctx.repo.getTitle(title.id) === undefined ||
        !sameRecord(ctx.repo.getTitle(title.id), baseline) ||
        !attachmentsMatch(ctx, 'title', title.id, attachments)
      ) {
        return false;
      }
      const captured = (consumers.sources ?? []).map((source) => source.id).sort();
      const live = ctx.repo
        .listSourcesForTitle(title.id)
        .map((source) => source.id)
        .sort();
      return JSON.stringify(captured) === JSON.stringify(live);
    },
  );
}

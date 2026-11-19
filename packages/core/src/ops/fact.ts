import type { AttachmentsSnapshot, FactRecord } from '../model/types';
import { emptyAttachments } from '../model/types';
import { withRedoSafe, type Op } from './op';
import { attachmentsMatch, restoreFact, sameRecord } from './restore';

export function addFactOp(fact: FactRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'fact.add',
    timestamp: new Date().toISOString(),
    change: { targetType: 'fact', targetId: fact.id, kind: 'created' },
    apply(ctx) {
      ctx.repo.insertFact(fact);
    },
    inverse(ctx) {
      ctx.repo.deleteFact(fact.id);
    },
  };
}

export function updateFactOp(before: FactRecord, after: FactRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'fact.update',
    timestamp: new Date().toISOString(),
    change: { targetType: 'fact', targetId: before.id, kind: 'changed' },
    apply(ctx) {
      ctx.repo.updateFact(after);
    },
    inverse(ctx) {
      ctx.repo.updateFact(before);
    },
  };
}

/** Deletes a fact together with its attachments; undo restores both. */
export function deleteFactOp(fact: FactRecord, attachments: AttachmentsSnapshot = emptyAttachments()): Op {
  let baseline = fact;
  let attachmentBaseline = attachments;
  return withRedoSafe(
    {
      id: crypto.randomUUID(),
      kind: 'fact.delete',
      timestamp: new Date().toISOString(),
      ...(fact.personId !== undefined
        ? { change: { targetType: 'person', targetId: fact.personId, kind: 'changed' as const } }
        : fact.familyId !== undefined
          ? { change: { targetType: 'family', targetId: fact.familyId, kind: 'changed' as const } }
          : {}),
      apply(ctx) {
        ctx.repo.deleteFact(fact.id);
      },
      inverse(ctx) {
        if (restoreFact(ctx, fact)) {
          baseline = ctx.repo.getFact(fact.id) ?? fact;
          ctx.repo.restoreAttachments(attachments);
          attachmentBaseline = ctx.repo.listAttachmentsFor('fact', fact.id);
        }
      },
    },
    (ctx) =>
      ctx.repo.getFact(fact.id) !== undefined &&
      sameRecord(ctx.repo.getFact(fact.id), baseline) &&
      attachmentsMatch(ctx, 'fact', fact.id, attachmentBaseline),
  );
}

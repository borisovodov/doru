import type { AttachmentsSnapshot, FactRecord } from '../model/types';
import { emptyAttachments } from '../model/types';
import { withRedoSafe, type MutationContext, type Op } from './op';
import { attachmentsMatch, restoreFact, sameRecord } from './restore';

/**
 * The owning record whose edit instant a fact change moves. Facts are part of
 * the person/family aggregate, but they have their own mutation path, so the
 * op carries the owner's previous and next `updatedAt` and restores it on
 * undo. A fact can change owners; both sides are stamped.
 */
export interface FactOwnerStamp {
  targetType: 'person' | 'family';
  targetId: string;
  before: number | undefined;
  after: number;
}

function applyOwnerStamps(ctx: MutationContext, stamps: readonly FactOwnerStamp[], side: 'before' | 'after'): void {
  for (const stamp of stamps) {
    if (stamp.targetType === 'person') {
      ctx.repo.setPersonUpdatedAt(stamp.targetId, stamp[side]);
    } else {
      ctx.repo.setFamilyUpdatedAt(stamp.targetId, stamp[side]);
    }
  }
}

function ownerStampsMatch(ctx: MutationContext, stamps: readonly FactOwnerStamp[]): boolean {
  return stamps.every((stamp) => {
    const current =
      stamp.targetType === 'person'
        ? ctx.repo.getPerson(stamp.targetId)?.updatedAt
        : ctx.repo.getFamily(stamp.targetId)?.updatedAt;
    return current === stamp.before;
  });
}

export function addFactOp(fact: FactRecord, ownerStamps: readonly FactOwnerStamp[] = []): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'fact.add',
    timestamp: new Date().toISOString(),
    change: { targetType: 'fact', targetId: fact.id, kind: 'created' },
    dependsOn: [fact.personId, fact.familyId].filter((id): id is string => id !== undefined),
    apply(ctx) {
      ctx.repo.insertFact(fact);
      applyOwnerStamps(ctx, ownerStamps, 'after');
    },
    inverse(ctx) {
      ctx.repo.deleteFact(fact.id);
      applyOwnerStamps(ctx, ownerStamps, 'before');
    },
  };
}

export function updateFactOp(before: FactRecord, after: FactRecord, ownerStamps: readonly FactOwnerStamp[] = []): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'fact.update',
    timestamp: new Date().toISOString(),
    change: { targetType: 'fact', targetId: before.id, kind: 'changed' },
    apply(ctx) {
      ctx.repo.updateFact(after);
      applyOwnerStamps(ctx, ownerStamps, 'after');
    },
    inverse(ctx) {
      ctx.repo.updateFact(before);
      applyOwnerStamps(ctx, ownerStamps, 'before');
    },
    redoSafe(ctx) {
      const current = ctx.repo.getFact(before.id);
      return current !== undefined && sameRecord(current, before) && ownerStampsMatch(ctx, ownerStamps);
    },
  };
}

/** Deletes a fact together with its attachments; undo restores both. */
export function deleteFactOp(
  fact: FactRecord,
  attachments: AttachmentsSnapshot = emptyAttachments(),
  ownerStamps: readonly FactOwnerStamp[] = [],
): Op {
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
        applyOwnerStamps(ctx, ownerStamps, 'after');
      },
      inverse(ctx) {
        if (restoreFact(ctx, fact)) {
          baseline = ctx.repo.getFact(fact.id) ?? fact;
          ctx.repo.restoreAttachments(attachments);
          attachmentBaseline = ctx.repo.listAttachmentsFor('fact', fact.id);
        }
        applyOwnerStamps(ctx, ownerStamps, 'before');
      },
      snapshots: [attachments],
    },
    (ctx) =>
      ctx.repo.getFact(fact.id) !== undefined &&
      sameRecord(ctx.repo.getFact(fact.id), baseline) &&
      attachmentsMatch(ctx, 'fact', fact.id, attachmentBaseline) &&
      ownerStampsMatch(ctx, ownerStamps),
  );
}

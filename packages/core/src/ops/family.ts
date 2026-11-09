import type { AttachmentsSnapshot, FamilyRecord } from '../model/types';
import { emptyAttachments } from '../model/types';
import type { Op } from './op';

export function addFamilyOp(family: FamilyRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'family.add',
    timestamp: new Date().toISOString(),
    change: { targetType: 'family', targetId: family.id, kind: 'created' },
    apply(ctx) {
      ctx.repo.insertFamily(family);
    },
    inverse(ctx) {
      ctx.repo.deleteFamily(family.id);
    },
  };
}

export function updateFamilyOp(before: FamilyRecord, after: FamilyRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'family.update',
    timestamp: new Date().toISOString(),
    change: { targetType: 'family', targetId: before.id, kind: 'changed' },
    apply(ctx) {
      ctx.repo.updateFamily(after);
    },
    inverse(ctx) {
      ctx.repo.updateFamily(before);
    },
  };
}

/**
 * The attachments of one family link row (family_partner/family_child),
 * captured before the family (and its links) is deleted.
 */
export interface FamilyLinkAttachments {
  targetType: 'family_partner' | 'family_child';
  targetId: string;
  attachments: AttachmentsSnapshot;
}

export function deleteFamilyOp(
  family: FamilyRecord,
  attachments: AttachmentsSnapshot = emptyAttachments(),
  linkAttachments: FamilyLinkAttachments[] = [],
): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'family.delete',
    timestamp: new Date().toISOString(),
    change: { targetType: 'family', targetId: family.id, kind: 'changed' },
    apply(ctx) {
      ctx.repo.deleteFamily(family.id);
    },
    inverse(ctx) {
      ctx.repo.insertFamily(family);
      ctx.repo.restoreAttachments(attachments);
      for (const link of linkAttachments) {
        ctx.repo.restoreAttachments(link.attachments);
      }
    },
  };
}

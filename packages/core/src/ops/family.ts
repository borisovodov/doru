import type { AssociationRecord, AttachmentsSnapshot, FactRecord, FamilyRecord } from '../model/types';
import { emptyAttachments } from '../model/types';
import type { NestedAttachments, Op } from './op';

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

export function updateFamilyOp(
  before: FamilyRecord,
  after: FamilyRecord,
  removedLinkAttachments: FamilyLinkAttachments[] = [],
): Op {
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
      for (const link of removedLinkAttachments) {
        ctx.repo.restoreAttachments(link.attachments);
      }
    },
  };
}

/**
 * The attachments of one family link row (family_partner/family_child),
 * captured before the family (and its links) is deleted.
 */
export interface FamilyLinkAttachments {
  targetType: 'family_partner' | 'family_child' | 'family_marriage_status';
  targetId: string;
  attachments: AttachmentsSnapshot;
}

export function deleteFamilyOp(
  family: FamilyRecord,
  attachments: AttachmentsSnapshot = emptyAttachments(),
  linkAttachments: FamilyLinkAttachments[] = [],
  nestedAttachments: NestedAttachments[] = [],
  facts: FactRecord[] = [],
  associations: AssociationRecord[] = [],
  linkedFacts: FactRecord[] = [],
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
      for (const fact of facts) {
        ctx.repo.insertFact(fact);
      }
      const restoredAssociations = new Set<string>();
      for (const association of associations) {
        // The other person may have been deleted by another writer; the
        // association FK would abort the rest of the inverse.
        if (ctx.repo.getPerson(association.otherPersonId) === undefined) {
          continue;
        }
        ctx.repo.insertAssociation(association);
        restoredAssociations.add(association.id);
      }
      // Facts owned by the family were re-inserted with their links above.
      // Surviving facts may have been edited since the delete, so restore
      // only the link rows to this family instead of rewriting the fact.
      const reinserted = new Set(facts.map((fact) => fact.id));
      for (const fact of linkedFacts) {
        if (reinserted.has(fact.id)) {
          continue;
        }
        const current = ctx.repo.getFact(fact.id);
        if (current === undefined) {
          continue;
        }
        const existing = new Set((current.familyLinks ?? []).map((link) => link.id));
        for (const link of fact.familyLinks ?? []) {
          if (link.familyId === family.id && !existing.has(link.id)) {
            ctx.repo.insertFactFamilyLink(fact.id, link);
          }
        }
      }
      ctx.repo.restoreAttachments(attachments);
      for (const link of linkAttachments) {
        ctx.repo.restoreAttachments(link.attachments);
      }
      for (const nested of nestedAttachments) {
        if (nested.targetType === 'association' && !restoredAssociations.has(nested.targetId)) {
          continue;
        }
        ctx.repo.restoreAttachments(nested.attachments);
      }
    },
  };
}

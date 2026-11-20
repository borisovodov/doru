import type { AssociationRecord, AttachmentsSnapshot, FactRecord, FamilyRecord } from '../model/types';
import { emptyAttachments } from '../model/types';
import type { MutationContext, NestedAttachments, Op } from './op';
import {
  attachmentTargetExists,
  attachmentsMatch,
  restoreAssociation,
  restoreFact,
  restoreFamily,
  sameRecord,
} from './restore';

export function addFamilyOp(family: FamilyRecord, redoSafe?: NonNullable<Op['redoSafe']>): Op {
  return {
    ...(redoSafe ? { redoSafe } : {}),
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
  partnerRemap?: { from: string[]; to: string[] },
): Op {
  let baselineLinks = removedLinkAttachments;
  return {
    id: crypto.randomUUID(),
    kind: 'family.update',
    timestamp: new Date().toISOString(),
    change: { targetType: 'family', targetId: before.id, kind: 'changed' },
    snapshots: removedLinkAttachments.map((link) => link.attachments),
    apply(ctx) {
      ctx.repo.updateFamily(after);
      if (partnerRemap !== undefined) {
        remapAdoptionFacts(ctx, before.id, partnerRemap.from, partnerRemap.to);
      }
    },
    redoSafe(ctx) {
      const current = ctx.repo.getFamily(before.id);
      if (current === undefined || !sameRecord(current, before)) {
        return false;
      }
      for (const link of baselineLinks) {
        if (
          attachmentTargetExists(ctx, link.targetType, link.targetId) &&
          !attachmentsMatch(ctx, link.targetType, link.targetId, link.attachments)
        ) {
          return false;
        }
      }
      const graph = [...ctx.repo.listFamilies().filter((entry) => entry.id !== after.id), after];
      return !familyHasCycle(after, graph);
    },
    inverse(ctx) {
      ctx.repo.updateFamily(before);
      if (partnerRemap !== undefined) {
        remapAdoptionFacts(ctx, before.id, partnerRemap.to, partnerRemap.from);
      }
      for (const link of removedLinkAttachments) {
        ctx.repo.restoreAttachments(link.attachments);
      }
      baselineLinks = removedLinkAttachments
        .filter((link) => attachmentTargetExists(ctx, link.targetType, link.targetId))
        .map((link) => ({
          ...link,
          attachments: ctx.repo.listAttachmentsFor(link.targetType, link.targetId),
        }));
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
  let baselineFamily = family;
  let baselineFacts = facts;
  let baselineLinkedFacts = linkedFacts;
  let baselineAssociations = associations;
  let baselineLinkAttachments = linkAttachments;
  let baselineNestedAttachments = nestedAttachments;
  return {
    id: crypto.randomUUID(),
    kind: 'family.delete',
    timestamp: new Date().toISOString(),
    change: { targetType: 'family', targetId: family.id, kind: 'changed' },
    snapshots: [
      attachments,
      ...linkAttachments.map((link) => link.attachments),
      ...nestedAttachments.map((nested) => nested.attachments),
    ],
    apply(ctx) {
      ctx.repo.deleteFamily(family.id);
    },
    redoSafe(ctx) {
      const current = ctx.repo.getFamily(family.id);
      if (current === undefined || !sameRecord(current, baselineFamily)) {
        return false;
      }
      // New facts or associations pointing at the family since the undo
      // would disappear with the redo and are missing from the snapshot.
      if (!attachmentsMatch(ctx, 'family', family.id, attachments)) {
        return false;
      }
      for (const link of baselineLinkAttachments) {
        if (!attachmentsMatch(ctx, link.targetType, link.targetId, link.attachments)) {
          return false;
        }
      }
      const liveAssociations = ctx.repo.listAssociationsForFamily(family.id);
      const liveAssociationById = new Map(liveAssociations.map((association) => [association.id, association]));
      for (const nested of baselineNestedAttachments) {
        const exists =
          nested.targetType === 'fact'
            ? ctx.repo.getFact(nested.targetId) !== undefined
            : nested.targetType === 'association'
              ? liveAssociationById.has(nested.targetId)
              : attachmentTargetExists(ctx, nested.targetType, nested.targetId);
        if (exists && !attachmentsMatch(ctx, nested.targetType, nested.targetId, nested.attachments)) {
          return false;
        }
      }
      const capturedFactById = new Map(baselineFacts.map((fact) => [fact.id, fact]));
      for (const fact of ctx.repo.listFactsForFamily(family.id)) {
        const captured = capturedFactById.get(fact.id);
        if (captured === undefined || !sameRecord(captured, fact)) {
          return false;
        }
        capturedFactById.delete(fact.id);
      }
      if (capturedFactById.size > 0) {
        return false;
      }
      const capturedLinked = new Map(baselineLinkedFacts.map((fact) => [fact.id, fact]));
      for (const fact of ctx.repo.listFactsLinkedToFamily(family.id)) {
        const captured = capturedLinked.get(fact.id);
        if (captured === undefined) {
          return false;
        }
        const wanted = (captured.familyLinks ?? []).filter((link) => link.familyId === family.id);
        const live = (fact.familyLinks ?? []).filter((link) => link.familyId === family.id);
        if (!sameRecord(wanted, live)) {
          return false;
        }
        capturedLinked.delete(fact.id);
      }
      if (capturedLinked.size > 0) {
        return false;
      }
      const capturedAssociations = new Map(baselineAssociations.map((association) => [association.id, association]));
      for (const association of liveAssociations) {
        const captured = capturedAssociations.get(association.id);
        if (captured === undefined || !sameRecord(captured, association)) {
          return false;
        }
        capturedAssociations.delete(association.id);
      }
      return capturedAssociations.size === 0;
    },
    inverse(ctx) {
      restoreFamily(ctx, family);
      for (const fact of facts) {
        restoreFact(ctx, fact);
      }
      const restoredAssociations = new Set<string>();
      for (const association of associations) {
        // The other person may have been deleted by another writer; the
        // association FK would abort the rest of the inverse.
        if (restoreAssociation(ctx, association)) {
          restoredAssociations.add(association.id);
        }
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
      const restoredFamily = ctx.repo.getFamily(family.id);
      const restoredLinkIds = new Set([
        ...(restoredFamily?.partnerLinks ?? []).map((link) => link.id),
        ...(restoredFamily?.childLinks ?? []).map((link) => link.id),
        ...(restoredFamily?.marriageStatuses ?? []).map((status) => status.id),
      ]);
      for (const link of linkAttachments) {
        if (restoredLinkIds.has(link.targetId)) {
          ctx.repo.restoreAttachments(link.attachments);
        }
      }
      for (const nested of nestedAttachments) {
        if (nested.targetType === 'association' && !restoredAssociations.has(nested.targetId)) {
          continue;
        }
        ctx.repo.restoreAttachments(nested.attachments);
      }
      baselineFamily = ctx.repo.getFamily(family.id) ?? family;
      baselineFacts = ctx.repo.listFactsForFamily(family.id);
      baselineLinkedFacts = ctx.repo.listFactsLinkedToFamily(family.id);
      baselineAssociations = ctx.repo.listAssociationsForFamily(family.id);
      const restoredLinks = new Set([
        ...(baselineFamily.partnerLinks ?? []).map((link) => link.id),
        ...(baselineFamily.childLinks ?? []).map((link) => link.id),
        ...(baselineFamily.marriageStatuses ?? []).map((status) => status.id),
      ]);
      baselineLinkAttachments = linkAttachments
        .filter((link) => restoredLinks.has(link.targetId))
        .map((link) => ({
          ...link,
          attachments: ctx.repo.listAttachmentsFor(link.targetType, link.targetId),
        }));
      baselineNestedAttachments = nestedAttachments
        .filter((nested) => {
          if (nested.targetType === 'association') {
            return ctx.repo.listAssociations().some((entry) => entry.id === nested.targetId);
          }
          return ctx.repo.getFact(nested.targetId) !== undefined;
        })
        .map((nested) => ({
          ...nested,
          attachments: ctx.repo.listAttachmentsFor(nested.targetType, nested.targetId),
        }));
    },
  };
}

function remapAdoptionFacts(
  ctx: MutationContext,
  familyId: string,
  fromPartners: string[],
  toPartners: string[],
): void {
  const adoptersFor = (adoptedBy: NonNullable<FactRecord['familyLinks']>[number]['adoptedBy']): string[] => {
    if (adoptedBy === 'BOTH') {
      return fromPartners.slice(0, 2);
    }
    const index = adoptedBy === 'HUSB' ? 0 : 1;
    const personId = fromPartners[index];
    return personId === undefined ? [] : [personId];
  };
  const markerFor = (personIds: string[]): 'HUSB' | 'WIFE' | 'BOTH' | undefined => {
    const slots = new Set<'HUSB' | 'WIFE'>();
    for (const personId of personIds) {
      const index = toPartners.indexOf(personId);
      if (index === 0) {
        slots.add('HUSB');
      } else if (index === 1) {
        slots.add('WIFE');
      }
    }
    if (slots.size >= 2) {
      return 'BOTH';
    }
    return slots.values().next().value;
  };
  for (const fact of ctx.repo.listFactsLinkedToFamily(familyId)) {
    const familyLinks = (fact.familyLinks ?? []).map((link) => {
      if (link.familyId !== familyId || link.adoptedBy === undefined) {
        return link;
      }
      const adoptedBy = markerFor(adoptersFor(link.adoptedBy));
      if (adoptedBy === link.adoptedBy) {
        return link;
      }
      return { ...link, adoptedBy };
    });
    if (familyLinks.some((link, index) => link !== (fact.familyLinks ?? [])[index])) {
      ctx.repo.updateFact({ ...fact, familyLinks });
    }
  }
}

function activeChildIds(family: FamilyRecord): string[] {
  return family.childLinks !== undefined
    ? family.childLinks.filter((link) => link.status !== 'disproven').map((link) => link.childId)
    : family.children;
}

function partnerIds(family: FamilyRecord): string[] {
  return family.partnerLinks !== undefined ? family.partnerLinks.map((link) => link.personId) : family.partners;
}

function familyHasCycle(family: FamilyRecord, graph: FamilyRecord[]): boolean {
  for (const childId of activeChildIds(family)) {
    for (const parentId of partnerIds(family)) {
      if (isAncestor(childId, parentId, graph)) {
        return true;
      }
    }
  }
  return false;
}

function isAncestor(ancestorId: string, personId: string, graph: FamilyRecord[]): boolean {
  if (ancestorId === personId) {
    return true;
  }
  const seen = new Set<string>();
  const stack = [personId];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const family of graph) {
      if (!activeChildIds(family).includes(current)) {
        continue;
      }
      for (const parent of partnerIds(family)) {
        if (parent === ancestorId) {
          return true;
        }
        if (!seen.has(parent)) {
          seen.add(parent);
          stack.push(parent);
        }
      }
    }
  }
  return false;
}

import type {
  AssociationRecord,
  AttachmentsSnapshot,
  FactParticipant,
  FamilyRecord,
  PersonRecord,
} from '../model/types';
import { emptyAttachments } from '../model/types';
import type { FamilyLinkAttachments } from './family';
import type { NestedAttachments, Op } from './op';
import {
  attachmentTargetExists,
  attachmentsMatch,
  restoreAlias,
  restoreAssociation,
  restorePerson,
  sameRecord,
} from './restore';

export function updatePersonOp(
  before: PersonRecord,
  after: PersonRecord,
  removedAttachments: NestedAttachments[] = [],
): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'person.update',
    timestamp: new Date().toISOString(),
    change: { targetType: 'person', targetId: before.id, kind: 'changed' },
    apply(ctx) {
      ctx.repo.updatePerson(after);
    },
    inverse(ctx) {
      ctx.repo.updatePerson(before);
      for (const nested of removedAttachments) {
        ctx.repo.restoreAttachments(nested.attachments);
      }
    },
    redoSafe(ctx) {
      // Redo writes the saved aggregate; refuse if another writer changed the
      // person since the undo, so their facts and links are not overwritten.
      return sameRecord(ctx.repo.getPerson(before.id), before);
    },
  };
}

/**
 * Deletes a person together with their family links and every attachment:
 * apply detaches the person from every family and deletes the record (its
 * names and facts cascade); inverse restores everything, attachments
 * included — one undo step, no losses.
 */
export function deletePersonOp(
  person: PersonRecord,
  familyLinks: Array<{ before: FamilyRecord; after: FamilyRecord }>,
  attachments: AttachmentsSnapshot = emptyAttachments(),
  nestedAttachments: NestedAttachments[] = [],
  linkAttachments: FamilyLinkAttachments[] = [],
  associations: AssociationRecord[] = [],
  aliases: Array<{ id: string; personId: string; aliasId: string }> = [],
  participants: Array<{ factId: string; participant: FactParticipant }> = [],
): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'person.delete',
    timestamp: new Date().toISOString(),
    change: { targetType: 'person', targetId: person.id, kind: 'changed' },
    apply(ctx) {
      for (const link of familyLinks) {
        ctx.repo.updateFamily(link.after);
      }
      ctx.repo.deletePerson(person.id);
    },
    redoSafe(ctx) {
      const current = ctx.repo.getPerson(person.id);
      if (current === undefined || !sameRecord(current, person)) {
        return false;
      }
      if (!attachmentsMatch(ctx, 'person', person.id, attachments)) {
        return false;
      }
      for (const nested of nestedAttachments) {
        if (
          attachmentTargetExists(ctx, nested.targetType, nested.targetId) &&
          !attachmentsMatch(ctx, nested.targetType, nested.targetId, nested.attachments)
        ) {
          return false;
        }
      }
      for (const link of linkAttachments) {
        if (!attachmentsMatch(ctx, link.targetType, link.targetId, link.attachments)) {
          return false;
        }
      }
      // Anything attached to the person since the undo would be cascaded away
      // by the redo and could not be restored from the captured snapshot.
      const capturedFamilyIds = new Set(
        familyLinks
          .filter(
            (link) =>
              link.before.partners.includes(person.id) ||
              link.before.children.includes(person.id) ||
              (link.before.partnerLinks ?? []).some((entry) => entry.personId === person.id) ||
              (link.before.childLinks ?? []).some((entry) => entry.childId === person.id),
          )
          .map((link) => link.before.id),
      );
      for (const family of ctx.repo.listFamiliesForPerson(person.id)) {
        if (!capturedFamilyIds.has(family.id)) {
          return false;
        }
      }
      for (const link of familyLinks) {
        if (!sameRecord(ctx.repo.getFamily(link.before.id), link.before)) {
          return false;
        }
      }
      const capturedAssociationById = new Map(associations.map((association) => [association.id, association]));
      for (const association of ctx.repo.listAssociationsFor(person.id)) {
        const captured = capturedAssociationById.get(association.id);
        if (captured === undefined || !sameRecord(captured, association)) {
          return false;
        }
        capturedAssociationById.delete(association.id);
      }
      if (capturedAssociationById.size > 0) {
        return false;
      }
      const capturedAliases = new Set(aliases.map((alias) => alias.id));
      for (const alias of ctx.repo.listAliasRowsFor(person.id)) {
        if (!capturedAliases.has(alias.id)) {
          return false;
        }
      }
      const capturedParticipants = new Map(
        participants.map((entry) => [`${entry.factId}\u0000${entry.participant.id}`, entry.participant]),
      );
      for (const fact of current.facts) {
        for (const participant of fact.participants ?? []) {
          capturedParticipants.set(`${fact.id}\u0000${participant.id}`, participant);
        }
      }
      for (const entry of ctx.repo.listParticipantsForPerson(person.id)) {
        const captured = capturedParticipants.get(`${entry.factId}\u0000${entry.participant.id}`);
        if (captured === undefined || !sameRecord(captured, entry.participant)) {
          return false;
        }
        capturedParticipants.delete(`${entry.factId}\u0000${entry.participant.id}`);
      }
      if (capturedParticipants.size > 0) {
        return false;
      }
      return true;
    },
    inverse(ctx) {
      restorePerson(ctx, person);
      const restoredAssociations = new Set<string>();
      for (const association of associations) {
        if (restoreAssociation(ctx, association)) {
          restoredAssociations.add(association.id);
        }
      }
      for (const alias of aliases) {
        restoreAlias(ctx, alias.id, alias.personId, alias.aliasId);
      }
      for (const entry of [...participants].sort(
        (left, right) => left.participant.position - right.participant.position,
      )) {
        // The fact may have been deleted by another writer since the person
        // was removed; its FK would abort the rest of the inverse.
        if (ctx.repo.getFact(entry.factId) === undefined) {
          continue;
        }
        if (entry.participant.personId !== undefined && ctx.repo.getPerson(entry.participant.personId) === undefined) {
          continue;
        }
        ctx.repo.insertParticipant(entry.factId, entry.participant);
      }
      for (const link of familyLinks) {
        ctx.repo.updateFamily(link.before);
      }
      ctx.repo.restoreAttachments(attachments);
      for (const nested of nestedAttachments) {
        if (nested.targetType === 'association' && !restoredAssociations.has(nested.targetId)) {
          continue;
        }
        ctx.repo.restoreAttachments(nested.attachments);
      }
      for (const link of linkAttachments) {
        ctx.repo.restoreAttachments(link.attachments);
      }
    },
  };
}

/**
 * Moves a person (as a child) into another family: detaches them from their
 * current families and attaches them to the target one, creating it when it
 * does not exist. One undo step restores everything.
 */
export function reparentOp(
  familyLinks: Array<{ before: FamilyRecord; after: FamilyRecord }>,
  created: FamilyRecord | undefined,
  personId: string,
  linkAttachments: FamilyLinkAttachments[] = [],
): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'person.reparent',
    timestamp: new Date().toISOString(),
    change: { targetType: 'person', targetId: personId, kind: 'changed' },
    apply(ctx) {
      for (const link of familyLinks) {
        ctx.repo.updateFamily(link.after);
      }
      if (created) {
        ctx.repo.insertFamily(created);
      }
    },
    inverse(ctx) {
      if (created) {
        ctx.repo.deleteFamily(created.id);
      }
      for (const link of [...familyLinks].reverse()) {
        ctx.repo.updateFamily(link.before);
      }
      for (const link of linkAttachments) {
        ctx.repo.restoreAttachments(link.attachments);
      }
    },
  };
}

/**
 * Adds a person linked to an anchor (as a child, spouse or parent): creates
 * the person, updates or creates the linking family. One undo step removes
 * the person and the link.
 */
export function addRelativeOp(
  person: PersonRecord,
  familyLinks: Array<{ before: FamilyRecord; after: FamilyRecord }>,
  created: FamilyRecord | undefined,
): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'person.addRelative',
    timestamp: new Date().toISOString(),
    change: { targetType: 'person', targetId: person.id, kind: 'created' },
    apply(ctx) {
      ctx.repo.insertPerson(person);
      for (const link of familyLinks) {
        ctx.repo.updateFamily(link.after);
      }
      if (created) {
        ctx.repo.insertFamily(created);
      }
    },
    inverse(ctx) {
      if (created) {
        ctx.repo.deleteFamily(created.id);
      }
      for (const link of [...familyLinks].reverse()) {
        ctx.repo.updateFamily(link.before);
      }
      ctx.repo.deletePerson(person.id);
    },
  };
}

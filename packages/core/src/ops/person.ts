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
import { restoreAlias, restoreAssociation, restorePerson, sameRecord } from './restore';

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
      // Anything attached to the person since the undo would be cascaded away
      // by the redo and could not be restored from the captured snapshot.
      const capturedFamilies = new Set(
        familyLinks
          .filter((link) => link.before.partners.includes(person.id) || link.before.children.includes(person.id))
          .map((link) => link.before.id),
      );
      for (const family of ctx.repo.listFamiliesForPerson(person.id)) {
        if (!capturedFamilies.has(family.id)) {
          return false;
        }
      }
      const capturedAssociations = new Set(associations.map((association) => association.id));
      for (const association of ctx.repo.listAssociationsFor(person.id)) {
        if (!capturedAssociations.has(association.id)) {
          return false;
        }
      }
      const capturedAliases = new Set(aliases.map((alias) => alias.id));
      for (const alias of ctx.repo.listAliasRowsFor(person.id)) {
        if (!capturedAliases.has(alias.id)) {
          return false;
        }
      }
      const capturedParticipants = new Set(participants.map((entry) => `${entry.factId}:${entry.participant.id}`));
      for (const fact of current.facts) {
        for (const participant of fact.participants ?? []) {
          capturedParticipants.add(`${fact.id}:${participant.id}`);
        }
      }
      for (const entry of ctx.repo.listParticipantsForPerson(person.id)) {
        if (!capturedParticipants.has(`${entry.factId}:${entry.participant.id}`)) {
          return false;
        }
      }
      return true;
    },
    inverse(ctx) {
      restorePerson(ctx, person);
      for (const association of associations) {
        restoreAssociation(ctx, association);
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

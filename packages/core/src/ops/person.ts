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
    inverse(ctx) {
      ctx.repo.insertPerson(person);
      for (const association of associations) {
        ctx.repo.insertAssociation(association);
      }
      for (const alias of aliases) {
        ctx.repo.insertAlias(alias.id, alias.personId, alias.aliasId);
      }
      for (const entry of [...participants].sort(
        (left, right) => right.participant.position - left.participant.position,
      )) {
        // The fact may have been deleted by another writer since the person
        // was removed; its FK would abort the rest of the inverse.
        if (ctx.repo.getFact(entry.factId) !== undefined) {
          ctx.repo.insertParticipant(entry.factId, entry.participant);
        }
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

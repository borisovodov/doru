import type { AttachmentsSnapshot, FamilyRecord, PersonRecord } from '../model/types';
import { emptyAttachments } from '../model/types';
import type { Op } from './op';

export function updatePersonOp(before: PersonRecord, after: PersonRecord): Op {
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
      for (const link of familyLinks) {
        ctx.repo.updateFamily(link.before);
      }
      ctx.repo.restoreAttachments(attachments);
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

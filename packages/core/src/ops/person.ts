import type { FamilyRecord, PersonRecord } from '../model/types';
import type { Op } from './op';

export function updatePersonOp(before: PersonRecord, after: PersonRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'person.update',
    timestamp: new Date().toISOString(),
    apply(ctx) {
      ctx.repo.updatePerson(after);
    },
    inverse(ctx) {
      ctx.repo.updatePerson(before);
    },
  };
}

/**
 * Deletes a person together with their family links: apply detaches the
 * person from every family and deletes the record; inverse restores both —
 * one undo step, no orphaned links.
 */
export function deletePersonOp(
  person: PersonRecord,
  familyLinks: Array<{ before: FamilyRecord; after: FamilyRecord }>,
): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'person.delete',
    timestamp: new Date().toISOString(),
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
    },
  };
}

/**
 * Moves a person (as a child) into another family: detaches them from their
 * current families and attaches them to the target one, creating it when it
 * does not exist. One undo step restores everything.
 */
export function reparentOp(
  childId: string,
  familyLinks: Array<{ before: FamilyRecord; after: FamilyRecord }>,
  created: FamilyRecord | undefined,
): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'person.reparent',
    timestamp: new Date().toISOString(),
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

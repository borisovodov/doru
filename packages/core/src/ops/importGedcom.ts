import type { TreeDocument } from '../model/types';
import type { Op } from './op';

export interface GedcomImportOp extends Op {
  readonly source: string;
  readonly insertedPersons: string[];
  readonly insertedFamilies: string[];
}

export function importGedcomOp(actor: string, source: string, doc: TreeDocument): GedcomImportOp {
  const insertedPersons: string[] = [];
  const insertedFamilies: string[] = [];
  return {
    id: crypto.randomUUID(),
    kind: 'gedcom.import',
    timestamp: new Date().toISOString(),
    actor,
    source,
    insertedPersons,
    insertedFamilies,
    apply(ctx) {
      insertedPersons.length = 0;
      insertedFamilies.length = 0;
      ctx.repo.transaction(() => {
        for (const person of doc.persons.values()) {
          if (!ctx.repo.getPerson(person.id)) {
            ctx.repo.insertPerson(person);
            insertedPersons.push(person.id);
          }
        }
        for (const family of doc.families.values()) {
          if (!ctx.repo.getFamily(family.id)) {
            ctx.repo.insertFamily(family);
            insertedFamilies.push(family.id);
          }
        }
      });
    },
    inverse(ctx) {
      ctx.repo.transaction(() => {
        for (const id of [...insertedFamilies].reverse()) {
          ctx.repo.deleteFamily(id);
        }
        for (const id of [...insertedPersons].reverse()) {
          ctx.repo.deletePerson(id);
        }
      });
    },
  };
}

import type { PersonRecord } from '../model/types';
import type { Op } from './op';

export function addPersonOp(actor: string, person: PersonRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'person.add',
    timestamp: new Date().toISOString(),
    actor,
    apply(doc) {
      doc.persons.set(person.id, person);
    },
    inverse(doc) {
      if (doc.persons.get(person.id) === person) {
        doc.persons.delete(person.id);
      }
    },
  };
}

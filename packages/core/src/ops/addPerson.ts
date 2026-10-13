import type { PersonRecord } from '../model/types';
import type { Op } from './op';

export function addPersonOp(person: PersonRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'person.add',
    timestamp: new Date().toISOString(),
    apply(ctx) {
      ctx.repo.insertPerson(person);
    },
    inverse(ctx) {
      ctx.repo.deletePerson(person.id);
    },
  };
}

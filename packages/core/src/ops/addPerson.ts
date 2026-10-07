import type { PersonRecord } from '../model/types';
import type { Op } from './op';

export function addPersonOp(actor: string, person: PersonRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'person.add',
    timestamp: new Date().toISOString(),
    actor,
    apply(ctx) {
      ctx.repo.insertPerson(person);
    },
    inverse(ctx) {
      ctx.repo.deletePerson(person.id);
    },
  };
}

import type { PersonRecord } from '../model/types';
import type { Op } from './op';

export function addPersonOp(person: PersonRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'person.add',
    timestamp: new Date().toISOString(),
    change: { targetType: 'person', targetId: person.id, kind: 'created' },
    apply(ctx) {
      ctx.repo.insertPerson(person);
    },
    inverse(ctx) {
      ctx.repo.deletePerson(person.id);
    },
  };
}

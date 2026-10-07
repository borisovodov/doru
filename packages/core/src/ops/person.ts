import type { PersonRecord } from '../model/types';
import type { Op } from './op';

export function updatePersonOp(actor: string, before: PersonRecord, after: PersonRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'person.update',
    timestamp: new Date().toISOString(),
    actor,
    apply(ctx) {
      ctx.repo.updatePerson(after);
    },
    inverse(ctx) {
      ctx.repo.updatePerson(before);
    },
  };
}

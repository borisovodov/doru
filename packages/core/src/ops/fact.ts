import type { FactRecord } from '../model/types';
import type { Op } from './op';

export function addFactOp(fact: FactRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'fact.add',
    timestamp: new Date().toISOString(),
    apply(ctx) {
      ctx.repo.insertFact(fact);
    },
    inverse(ctx) {
      ctx.repo.deleteFact(fact.id);
    },
  };
}

export function deleteFactOp(fact: FactRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'fact.delete',
    timestamp: new Date().toISOString(),
    apply(ctx) {
      ctx.repo.deleteFact(fact.id);
    },
    inverse(ctx) {
      ctx.repo.insertFact(fact);
    },
  };
}

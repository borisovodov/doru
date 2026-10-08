import type { FamilyRecord } from '../model/types';
import type { Op } from './op';

export function addFamilyOp(actor: string, family: FamilyRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'family.add',
    timestamp: new Date().toISOString(),
    actor,
    apply(ctx) {
      ctx.repo.insertFamily(family);
    },
    inverse(ctx) {
      ctx.repo.deleteFamily(family.id);
    },
  };
}

export function updateFamilyOp(actor: string, before: FamilyRecord, after: FamilyRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'family.update',
    timestamp: new Date().toISOString(),
    actor,
    apply(ctx) {
      ctx.repo.updateFamily(after);
    },
    inverse(ctx) {
      ctx.repo.updateFamily(before);
    },
  };
}

export function deleteFamilyOp(actor: string, family: FamilyRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'family.delete',
    timestamp: new Date().toISOString(),
    actor,
    apply(ctx) {
      ctx.repo.deleteFamily(family.id);
    },
    inverse(ctx) {
      ctx.repo.insertFamily(family);
    },
  };
}

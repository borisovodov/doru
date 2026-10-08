import { describe, expect, it } from 'vitest';
import { addFamilyOp, deleteFamilyOp, updateFamilyOp } from '../src/ops/family';
import { cleanupRepo, makeRepo } from './helpers';

const family = { id: 'F1', parents: ['P1', 'P2'], children: ['P3'] };

describe('family ops', () => {
  it('adds, updates, and deletes families with undo', () => {
    const fixture = makeRepo();
    try {
      const ctx = { repo: fixture.repo };
      for (const id of ['P1', 'P2', 'P3']) {
        fixture.repo.insertPerson({ id, names: [], sex: 'U' });
      }

      const add = addFamilyOp('user', family);
      add.apply(ctx);
      expect(fixture.repo.getFamily('F1')?.parents).toEqual(['P1', 'P2']);

      const updated = { ...family, parents: ['P1'] };
      const update = updateFamilyOp('user', family, updated);
      update.apply(ctx);
      expect(fixture.repo.getFamily('F1')?.parents).toEqual(['P1']);
      update.inverse(ctx);
      expect(fixture.repo.getFamily('F1')?.parents).toEqual(['P1', 'P2']);

      const del = deleteFamilyOp('user', family);
      del.apply(ctx);
      expect(fixture.repo.getFamily('F1')).toBeUndefined();
      del.inverse(ctx);
      expect(fixture.repo.getFamily('F1')).toBeDefined();
    } finally {
      cleanupRepo(fixture);
    }
  });
});

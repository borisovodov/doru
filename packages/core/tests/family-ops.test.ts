import { describe, expect, it } from 'vitest';
import { addFamilyOp, deleteFamilyOp, updateFamilyOp } from '../src/ops/family';
import { cleanupRepo, makeRepo } from './helpers';

const family = { id: 'F1', partners: ['P1', 'P2'], children: ['P3'] };

describe('family ops', () => {
  it('adds, updates, and deletes families with undo', () => {
    const fixture = makeRepo();
    try {
      const ctx = { repo: fixture.repo };
      for (const id of ['P1', 'P2', 'P3']) {
        fixture.repo.insertPerson({ id, names: [], sex: 'U', facts: [] });
      }

      const add = addFamilyOp(family);
      add.apply(ctx);
      expect(fixture.repo.getFamily('F1')?.partners).toEqual(['P1', 'P2']);

      const updated = { ...family, partners: ['P1'] };
      const update = updateFamilyOp(family, updated);
      update.apply(ctx);
      expect(fixture.repo.getFamily('F1')?.partners).toEqual(['P1']);
      update.inverse(ctx);
      expect(fixture.repo.getFamily('F1')?.partners).toEqual(['P1', 'P2']);

      const del = deleteFamilyOp(family);
      del.apply(ctx);
      expect(fixture.repo.getFamily('F1')).toBeUndefined();
      del.inverse(ctx);
      expect(fixture.repo.getFamily('F1')).toBeDefined();
    } finally {
      cleanupRepo(fixture);
    }
  });
});

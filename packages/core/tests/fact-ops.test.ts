import { describe, expect, it } from 'vitest';
import { addFactOp, deleteFactOp, updateFactOp } from '../src/ops/fact';
import { addMediaOp, deleteMediaOp } from '../src/ops/media';
import { cleanupRepo, flatMedia, makeRepo } from './helpers';

describe('fact ops', () => {
  it('adds and deletes facts with dates and places and undo', () => {
    const fixture = makeRepo();
    try {
      const ctx = { repo: fixture.repo };
      fixture.repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      const fact = {
        id: 'E1',
        personId: 'P1',
        tag: 'BURI',
        date: { quality: 'exact' as const, component: { year: 1901 } },
        place: 'Moscow',
        value: 'Vagankovo cemetery',
      };
      const add = addFactOp(fact);
      add.apply(ctx);

      const facts = fixture.repo.listFactsForPerson('P1');
      expect(facts).toHaveLength(1);
      expect(facts[0]?.place).toBe('Moscow');
      expect(facts[0]?.date?.component?.year).toBe(1901);

      const del = deleteFactOp(fact);
      del.apply(ctx);
      expect(fixture.repo.listFactsForPerson('P1')).toEqual([]);
      del.inverse(ctx);
      expect(fixture.repo.listFactsForPerson('P1')).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('moves a fact from a person to a family and back on undo', () => {
    const fixture = makeRepo();
    try {
      const ctx = { repo: fixture.repo };
      fixture.repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      fixture.repo.insertFamily({ id: 'F1', partners: ['P1'], children: [] });
      const fact = { id: 'E1', personId: 'P1', tag: 'MARR' };
      addFactOp(fact).apply(ctx);

      const moved = { ...fact, personId: undefined, familyId: 'F1' };
      const op = updateFactOp(fact, moved);
      op.apply(ctx);
      expect(fixture.repo.listFactsForPerson('P1')).toEqual([]);
      expect(fixture.repo.listFactsForFamily('F1')).toHaveLength(1);

      op.inverse(ctx);
      expect(fixture.repo.listFactsForPerson('P1')).toHaveLength(1);
      expect(fixture.repo.listFactsForFamily('F1')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });
});

describe('media ops', () => {
  it('attaches media to a person and undoes it', () => {
    const fixture = makeRepo();
    try {
      const ctx = { repo: fixture.repo };
      const media = { id: 'M1', path: 'media/photo.jpg', title: 'Portrait', targetType: 'person', targetId: 'P1' };
      const add = addMediaOp(media);
      add.apply(ctx);
      expect(fixture.repo.listMediaFor('person', 'P1').map(flatMedia)).toEqual([media]);

      const del = deleteMediaOp(media);
      del.apply(ctx);
      expect(fixture.repo.listMediaFor('person', 'P1')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });
});

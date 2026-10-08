import { describe, expect, it } from 'vitest';
import { addEventOp, addMediaOp, deleteEventOp, deleteMediaOp } from '../src/ops/record';
import { cleanupRepo, makeRepo } from './helpers';

describe('event ops', () => {
  it('adds and deletes events with places and undo', () => {
    const fixture = makeRepo();
    try {
      const ctx = { repo: fixture.repo };
      fixture.repo.insertPerson({ id: 'P1', names: [], sex: 'U' });
      const event = {
        id: 'E1',
        type: 'BURI',
        date: { year: 1901, quality: 'exact' as const },
        place: 'Moscow',
        description: 'Vagankovo cemetery',
        personId: 'P1',
      };
      const add = addEventOp('user', event);
      add.apply(ctx);

      const events = fixture.repo.listEventsForPerson('P1');
      expect(events).toHaveLength(1);
      expect(events[0]?.place).toBe('Moscow');
      expect(events[0]?.date?.year).toBe(1901);

      const del = deleteEventOp('user', event);
      del.apply(ctx);
      expect(fixture.repo.listEventsForPerson('P1')).toEqual([]);
      del.inverse(ctx);
      expect(fixture.repo.listEventsForPerson('P1')).toHaveLength(1);
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
      const media = { id: 'M1', path: 'media/photo.jpg', caption: 'Portrait', targetType: 'person', targetId: 'P1' };
      const add = addMediaOp('user', media);
      add.apply(ctx);
      expect(fixture.repo.listMediaFor('person', 'P1')).toEqual([media]);

      const del = deleteMediaOp('user', media);
      del.apply(ctx);
      expect(fixture.repo.listMediaFor('person', 'P1')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });
});

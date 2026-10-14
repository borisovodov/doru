import { describe, expect, it } from 'vitest';
import type { PersonRecord } from '../src/model/types';
import { addPersonOp } from '../src/ops/addPerson';
import { OpQueue } from '../src/ops/op';
import { deletePersonOp, updatePersonOp } from '../src/ops/person';
import { cleanupRepo, makeRepo } from './helpers';

const person: PersonRecord = {
  id: 'P1',
  names: [{ given: 'Ivan', surname: 'Ivanov' }],
  sex: 'M',
};

describe('OpQueue', () => {
  it('applies ops and supports undo/redo', () => {
    const fixture = makeRepo();
    try {
      const queue = new OpQueue();
      const ctx = { repo: fixture.repo };

      const op = addPersonOp(person);
      queue.apply(op, ctx);
      expect(fixture.repo.getPerson('P1')).toEqual(person);

      expect(queue.canUndo()).toBe(true);
      expect(queue.canRedo()).toBe(false);

      queue.undo(ctx);
      expect(fixture.repo.getPerson('P1')).toBeUndefined();
      expect(queue.canRedo()).toBe(true);

      queue.redo(ctx);
      expect(fixture.repo.getPerson('P1')).toEqual(person);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('clears the redo stack when a new op is applied', () => {
    const fixture = makeRepo();
    try {
      const queue = new OpQueue();
      const ctx = { repo: fixture.repo };

      queue.apply(addPersonOp(person), ctx);
      queue.undo(ctx);
      expect(queue.canRedo()).toBe(true);

      const other: PersonRecord = { id: 'P2', names: [], sex: 'U' };
      queue.apply(addPersonOp(other), ctx);
      expect(queue.canRedo()).toBe(false);
      expect(fixture.repo.countPersons()).toBe(1);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('updates a person and restores it on undo', () => {
    const fixture = makeRepo();
    try {
      const queue = new OpQueue();
      const ctx = { repo: fixture.repo };

      queue.apply(addPersonOp(person), ctx);
      const renamed: PersonRecord = { ...person, names: [{ given: 'John' }] };
      queue.apply(updatePersonOp(person, renamed), ctx);
      expect(fixture.repo.getPerson('P1')).toEqual(renamed);

      queue.undo(ctx);
      expect(fixture.repo.getPerson('P1')).toEqual(person);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('deletes a person with family links and restores both on undo', () => {
    const fixture = makeRepo();
    try {
      const queue = new OpQueue();
      const ctx = { repo: fixture.repo };
      queue.apply(addPersonOp(person), ctx);
      fixture.repo.insertPerson({ id: 'P2', names: [], sex: 'F' });
      const family = { id: 'F1', parents: ['P1', 'P2'], children: [] };
      fixture.repo.insertFamily(family);

      queue.apply(
        deletePersonOp(person, [
          { before: family, after: { ...family, parents: ['P2'] } },
        ]),
        ctx,
      );
      expect(fixture.repo.getPerson('P1')).toBeUndefined();
      expect(fixture.repo.getFamily('F1')?.parents).toEqual(['P2']);

      queue.undo(ctx);
      expect(fixture.repo.getPerson('P1')).toEqual(person);
      expect(fixture.repo.getFamily('F1')?.parents).toEqual(['P1', 'P2']);
    } finally {
      cleanupRepo(fixture);
    }
  });
});

import { describe, expect, it } from 'vitest';
import type { PersonRecord } from '../src/model/types';
import { addPersonOp } from '../src/ops/addPerson';
import { OpQueue, type Op } from '../src/ops/op';
import { cleanupRepo, makeRepo } from './helpers';

const person: PersonRecord = {
  id: 'P1',
  names: [{ given: 'Ivan', surname: 'Ivanov' }],
  sex: 'M',
};

describe('OpQueue', () => {
  it('applies ops, supports undo/redo, and reports to the audit log', () => {
    const fixture = makeRepo();
    try {
      const audited: Op[] = [];
      const queue = new OpQueue((op) => audited.push(op));
      const ctx = { repo: fixture.repo };

      const op = addPersonOp('user', person);
      queue.apply(op, ctx);
      expect(fixture.repo.getPerson('P1')).toEqual(person);
      expect(audited).toEqual([op]);

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

      queue.apply(addPersonOp('user', person), ctx);
      queue.undo(ctx);
      expect(queue.canRedo()).toBe(true);

      const other: PersonRecord = { id: 'P2', names: [], sex: 'U' };
      queue.apply(addPersonOp('user', other), ctx);
      expect(queue.canRedo()).toBe(false);
      expect(fixture.repo.countPersons()).toBe(1);
    } finally {
      cleanupRepo(fixture);
    }
  });
});

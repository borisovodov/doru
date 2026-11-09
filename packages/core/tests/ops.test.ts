import { describe, expect, it } from 'vitest';
import type { PersonRecord } from '../src/model/types';
import { addPersonOp } from '../src/ops/addPerson';
import { OpQueue } from '../src/ops/op';
import { addRelativeOp, deletePersonOp, reparentOp, updatePersonOp } from '../src/ops/person';
import { cleanupRepo, flatPerson, makeRepo } from './helpers';

const person: PersonRecord = {
  id: 'P1',
  names: [{ id: 'N1', given: 'Ivan', surname: 'Ivanov' }],
  sex: 'M',
  facts: [],
};

const emptyPerson = (id: string, sex: PersonRecord['sex'] = 'U'): PersonRecord => ({
  id,
  names: [],
  sex,
  facts: [],
});

describe('OpQueue', () => {
  it('applies ops and supports undo/redo', () => {
    const fixture = makeRepo();
    try {
      const queue = new OpQueue();
      const ctx = { repo: fixture.repo };

      const op = addPersonOp(person);
      queue.apply(op, ctx);
      expect(flatPerson(fixture.repo.getPerson('P1')!)).toEqual(person);

      expect(queue.canUndo()).toBe(true);
      expect(queue.canRedo()).toBe(false);

      queue.undo(ctx);
      expect(fixture.repo.getPerson('P1')).toBeUndefined();
      expect(queue.canRedo()).toBe(true);

      queue.redo(ctx);
      expect(flatPerson(fixture.repo.getPerson('P1')!)).toEqual(person);
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

      queue.apply(addPersonOp(emptyPerson('P2')), ctx);
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
      const renamed: PersonRecord = { ...person, names: [{ id: 'N1', given: 'John' }] };
      queue.apply(updatePersonOp(person, renamed), ctx);
      expect(flatPerson(fixture.repo.getPerson('P1')!)).toEqual(renamed);

      queue.undo(ctx);
      expect(flatPerson(fixture.repo.getPerson('P1')!)).toEqual(person);
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
      fixture.repo.insertPerson(emptyPerson('P2', 'F'));
      const family = { id: 'F1', partners: ['P1', 'P2'], children: [] };
      fixture.repo.insertFamily(family);

      queue.apply(
        deletePersonOp(person, [
          { before: family, after: { ...family, partners: ['P2'] } },
        ]),
        ctx,
      );
      expect(fixture.repo.getPerson('P1')).toBeUndefined();
      expect(fixture.repo.getFamily('F1')?.partners).toEqual(['P2']);

      queue.undo(ctx);
      expect(flatPerson(fixture.repo.getPerson('P1')!)).toEqual(person);
      expect(fixture.repo.getFamily('F1')?.partners).toEqual(['P1', 'P2']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('addRelativeOp creates a person and links them as a child of an existing family', () => {
    const fixture = makeRepo();
    try {
      const queue = new OpQueue();
      const ctx = { repo: fixture.repo };
      fixture.repo.insertPerson(person);
      const family = { id: 'F1', partners: ['P1'], children: [] };
      fixture.repo.insertFamily(family);

      const child = emptyPerson('K1');
      const after = { ...family, children: ['K1'] };
      queue.apply(addRelativeOp(child, [{ before: family, after }], undefined), ctx);

      expect(flatPerson(fixture.repo.getPerson('K1')!)).toEqual(child);
      expect(fixture.repo.getFamily('F1')?.children).toEqual(['K1']);

      queue.undo(ctx);
      expect(fixture.repo.getPerson('K1')).toBeUndefined();
      expect(fixture.repo.getFamily('F1')?.children).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('addRelativeOp creates the linking family when none exists', () => {
    const fixture = makeRepo();
    try {
      const queue = new OpQueue();
      const ctx = { repo: fixture.repo };
      fixture.repo.insertPerson(person);

      const spouse = emptyPerson('S1', 'F');
      const created = { id: 'F2', partners: ['P1', 'S1'], children: [] };
      queue.apply(addRelativeOp(spouse, [], created), ctx);

      expect(flatPerson(fixture.repo.getPerson('S1')!)).toEqual(spouse);
      expect(fixture.repo.getFamily('F2')?.partners).toEqual(['P1', 'S1']);

      queue.undo(ctx);
      expect(fixture.repo.getPerson('S1')).toBeUndefined();
      expect(fixture.repo.getFamily('F2')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('reparentOp moves a child between families and restores both on undo', () => {
    const fixture = makeRepo();
    try {
      const queue = new OpQueue();
      const ctx = { repo: fixture.repo };
      for (const id of ['A', 'B', 'K']) {
        fixture.repo.insertPerson(emptyPerson(id));
      }
      const from = { id: 'F1', partners: ['A'], children: ['K'] };
      const to = { id: 'F2', partners: ['B'], children: [] };
      fixture.repo.insertFamily(from);
      fixture.repo.insertFamily(to);

      queue.apply(
        reparentOp([
          { before: from, after: { ...from, children: [] } },
          { before: to, after: { ...to, children: ['K'] } },
        ], undefined),
        ctx,
      );
      expect(fixture.repo.getFamily('F1')?.children).toEqual([]);
      expect(fixture.repo.getFamily('F2')?.children).toEqual(['K']);

      queue.undo(ctx);
      expect(fixture.repo.getFamily('F1')?.children).toEqual(['K']);
      expect(fixture.repo.getFamily('F2')?.children).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('reparentOp creates the target family when none exists', () => {
    const fixture = makeRepo();
    try {
      const queue = new OpQueue();
      const ctx = { repo: fixture.repo };
      for (const id of ['A', 'B', 'K']) {
        fixture.repo.insertPerson(emptyPerson(id));
      }
      const from = { id: 'F1', partners: ['A'], children: ['K'] };
      fixture.repo.insertFamily(from);
      const created = { id: 'F2', partners: ['B'], children: ['K'] };

      queue.apply(
        reparentOp([{ before: from, after: { ...from, children: [] } }], created),
        ctx,
      );
      expect(fixture.repo.getFamily('F1')?.children).toEqual([]);
      expect(fixture.repo.getFamily('F2')?.children).toEqual(['K']);

      queue.undo(ctx);
      expect(fixture.repo.getFamily('F1')?.children).toEqual(['K']);
      expect(fixture.repo.getFamily('F2')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });
});

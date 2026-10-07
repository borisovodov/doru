import { describe, expect, it } from 'vitest';
import { emptyDocument, type PersonRecord } from '../src/model/types';
import { addPersonOp } from '../src/ops/addPerson';
import { OpQueue, type Op } from '../src/ops/op';

const person: PersonRecord = {
  id: 'P1',
  names: [{ given: 'Ivan', surname: 'Ivanov' }],
  sex: 'M',
};

describe('OpQueue', () => {
  it('applies ops, supports undo/redo, and reports to the audit log', () => {
    const audited: Op[] = [];
    const queue = new OpQueue((op) => audited.push(op));
    const doc = emptyDocument();

    const op = addPersonOp('user', person);
    queue.apply(op, doc);
    expect(doc.persons.get('P1')).toBe(person);
    expect(audited).toEqual([op]);

    expect(queue.canUndo()).toBe(true);
    expect(queue.canRedo()).toBe(false);

    queue.undo(doc);
    expect(doc.persons.has('P1')).toBe(false);
    expect(queue.canRedo()).toBe(true);

    queue.redo(doc);
    expect(doc.persons.get('P1')).toBe(person);
  });

  it('clears the redo stack when a new op is applied', () => {
    const queue = new OpQueue();
    const doc = emptyDocument();

    queue.apply(addPersonOp('user', person), doc);
    queue.undo(doc);
    expect(queue.canRedo()).toBe(true);

    const other: PersonRecord = { id: 'P2', names: [], sex: 'U' };
    queue.apply(addPersonOp('user', other), doc);
    expect(queue.canRedo()).toBe(false);
  });
});

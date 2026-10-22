import { describe, expect, it } from 'vitest';
import type { MutationContext, Op } from '@doru/core';
import { isSelfWriteEcho, markSelfWrite, StampedOpQueue } from '../src/main/tree-watcher';

const context = {} as MutationContext;

function fakeOp(id: string): Op {
  return {
    id,
    kind: 'test',
    timestamp: new Date().toISOString(),
    apply: () => undefined,
    inverse: () => undefined,
  };
}

describe('StampedOpQueue', () => {
  it('preserves the OpQueue behavior while stamping every mutation', () => {
    let writes = 0;
    const queue = new StampedOpQueue(() => {
      writes += 1;
    });
    const op = fakeOp('op1');

    queue.apply(op, context);
    expect(writes).toBe(1);
    expect(queue.canUndo()).toBe(true);
    expect(queue.canRedo()).toBe(false);

    queue.undo(context);
    expect(writes).toBe(2);
    expect(queue.canUndo()).toBe(false);
    expect(queue.canRedo()).toBe(true);

    queue.redo(context);
    expect(writes).toBe(3);

    // An empty stack stamps nothing.
    expect(queue.undo(context)).toBe(op);
    expect(writes).toBe(4);
    expect(queue.undo(context)).toBeUndefined();
    expect(writes).toBe(4);
  });

  it('clears the redo stack on apply like the real queue', () => {
    const queue = new StampedOpQueue(() => undefined);
    const first = fakeOp('first');
    const second = fakeOp('second');

    queue.apply(first, context);
    queue.undo(context);
    queue.apply(second, context);
    expect(queue.canRedo()).toBe(false);
    expect(queue.undo(context)).toBe(second);
  });
});

describe('isSelfWriteEcho', () => {
  it('ignores events shortly after the app\'s own write', () => {
    const path = '/tmp/doru-self-write.doru';
    const stamped = Date.now();
    markSelfWrite(path);
    expect(isSelfWriteEcho(path, stamped + 500)).toBe(true);
    expect(isSelfWriteEcho(path, stamped + 5000)).toBe(false);
    expect(isSelfWriteEcho('/tmp/other.doru', stamped + 500)).toBe(false);
  });
});

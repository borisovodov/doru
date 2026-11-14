import { describe, expect, it } from 'vitest';
import { moveItem } from '../src/domain/reorder';

describe('moveItem', () => {
  it('moves an item up and down', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('returns the same order for no-op and out-of-range moves', () => {
    const items = ['a', 'b', 'c'];
    expect(moveItem(items, 1, 1)).toEqual(items);
    expect(moveItem(items, -1, 1)).toEqual(items);
    expect(moveItem(items, 0, 9)).toEqual(items);
  });
});

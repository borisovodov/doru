import { describe, expect, it } from 'vitest';
import { dropIndexForTabs, moveTab } from '../src/tabReorder';

const tabs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('dropIndexForTabs', () => {
  it('drops before a later tab', () => {
    expect(dropIndexForTabs(tabs, 'a', 1, true)).toBe(0);
  });

  it('drops after a later tab', () => {
    expect(dropIndexForTabs(tabs, 'a', 1, false)).toBe(1);
  });

  it('drops before an earlier tab', () => {
    expect(dropIndexForTabs(tabs, 'c', 0, true)).toBe(0);
  });

  it('drops after an earlier tab', () => {
    expect(dropIndexForTabs(tabs, 'c', 1, false)).toBe(2);
  });

  it('drops between the two neighbors', () => {
    expect(dropIndexForTabs(tabs, 'b', 2, true)).toBe(1);
  });

  it('returns null when hovering the dragged tab itself', () => {
    expect(dropIndexForTabs(tabs, 'b', 1, true)).toBeNull();
    expect(dropIndexForTabs(tabs, 'b', 1, false)).toBeNull();
  });

  it('returns null for an unknown dragged id', () => {
    expect(dropIndexForTabs(tabs, 'zz', 0, true)).toBeNull();
  });
});

describe('moveTab', () => {
  it('moves a tab to a later position', () => {
    expect(moveTab(tabs, 'a', 2).map((tab) => tab.id)).toEqual(['b', 'c', 'a']);
  });

  it('moves a tab to an earlier position', () => {
    expect(moveTab(tabs, 'c', 0).map((tab) => tab.id)).toEqual(['c', 'a', 'b']);
  });

  it('keeps the order when the move is a no-op', () => {
    expect(moveTab(tabs, 'b', 1).map((tab) => tab.id)).toEqual(['a', 'b', 'c']);
  });

  it('clamps the index to the available range', () => {
    expect(moveTab(tabs, 'a', 99).map((tab) => tab.id)).toEqual(['b', 'c', 'a']);
    expect(moveTab(tabs, 'c', -3).map((tab) => tab.id)).toEqual(['c', 'a', 'b']);
  });

  it('returns the same list for an unknown id', () => {
    expect(moveTab(tabs, 'zz', 0)).toBe(tabs);
  });

  it('does not mutate the input', () => {
    const input = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
    const output = moveTab(input, 'z', 0);
    expect(input.map((tab) => tab.id)).toEqual(['x', 'y', 'z']);
    expect(output.map((tab) => tab.id)).toEqual(['z', 'x', 'y']);
  });
});

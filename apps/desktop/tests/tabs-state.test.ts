import { describe, expect, it } from 'vitest';
import {
  closeTab,
  nextTabId,
  openTab,
  prevTabId,
  reorderTabs,
  replaceTab,
  tabIdAt,
  type TabsState,
} from '../src/renderer/src/tabs/state';

function state(ids: string[], activeTabId = ids[0] ?? null): TabsState {
  return {
    openTabs: ids.map((id) => ({ id, closable: true })),
    activeTabId,
  };
}

describe('tabs state', () => {
  it('opens a tab once and activates it', () => {
    const first = openTab(state([]), 'tree');
    expect(first).toEqual({ openTabs: [{ id: 'tree', closable: true }], activeTabId: 'tree' });

    const second = openTab(first, 'person:1');
    expect(second.openTabs.map((tab) => tab.id)).toEqual(['tree', 'person:1']);
    expect(second.activeTabId).toBe('person:1');

    const third = openTab(second, 'tree');
    expect(third.openTabs.map((tab) => tab.id)).toEqual(['tree', 'person:1']);
    expect(third.activeTabId).toBe('tree');
  });

  it('closes the active tab and falls back to the neighbour', () => {
    expect(closeTab(state(['a', 'b', 'c'], 'b'), 'b')).toEqual({
      openTabs: [
        { id: 'a', closable: true },
        { id: 'c', closable: true },
      ],
      activeTabId: 'c',
    });

    expect(closeTab(state(['a', 'b'], 'b'), 'b').activeTabId).toBe('a');
    expect(closeTab(state(['a'], 'a'), 'a')).toEqual({ openTabs: [], activeTabId: null });
  });

  it('keeps the active tab when another one closes', () => {
    expect(closeTab(state(['a', 'b'], 'a'), 'b').activeTabId).toBe('a');
  });

  it('re-keys a tab and follows it when active', () => {
    expect(replaceTab(state(['a', 'b'], 'a'), 'a', 'new:a')).toEqual({
      openTabs: [
        { id: 'new:a', closable: true },
        { id: 'b', closable: true },
      ],
      activeTabId: 'new:a',
    });

    expect(replaceTab(state(['a', 'b'], 'b'), 'a', 'b').openTabs.map((tab) => tab.id)).toEqual(['b']);
  });

  it('cycles and clamps tab selection', () => {
    expect(nextTabId(state(['a', 'b'], 'b'))).toBe('a');
    expect(prevTabId(state(['a', 'b'], 'a'))).toBe('b');
    expect(tabIdAt(state(['a', 'b'], 'a'), 9)).toBe('b');
    expect(tabIdAt(state(['a', 'b'], 'a'), -1)).toBe('a');
    expect(nextTabId(state([], null))).toBeNull();
  });

  it('reorders tabs', () => {
    expect(reorderTabs(state(['a', 'b', 'c'], 'a'), 'a', 2).openTabs.map((tab) => tab.id)).toEqual(['b', 'c', 'a']);
  });
});

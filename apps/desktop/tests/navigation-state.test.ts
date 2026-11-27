import { describe, expect, it } from 'vitest';
import {
  EMPTY_NAVIGATION_HISTORY,
  NAVIGATION_HISTORY_LIMIT,
  backIndex,
  forwardIndex,
  locationKey,
  pushLocation,
  type NavigationHistory,
  type NavigationLocation,
} from '../src/renderer/src/navigation/state';

const location = (tabId: string, treeFocusPersonId: string | null = null): NavigationLocation => ({
  tabId,
  treeFocusPersonId,
});

function history(entries: NavigationLocation[], index = entries.length - 1): NavigationHistory {
  return { entries, index };
}

const reachable = (): boolean => true;

describe('navigation history', () => {
  it('appends locations and drops the forward branch', () => {
    const first = pushLocation(EMPTY_NAVIGATION_HISTORY, location('tree', 'P1'));
    const second = pushLocation(first, location('person:P1'));
    const third = pushLocation(second, location('tree', 'P2'));
    const branched = pushLocation({ ...third, index: 0 }, location('tree', 'P3'));

    expect(branched.entries).toEqual([location('tree', 'P1'), location('tree', 'P3')]);
    expect(branched.index).toBe(1);
  });

  it('does not duplicate the current location', () => {
    const state = history([location('tree', 'P1'), location('person:P1')], 0);
    expect(pushLocation(state, state.entries[0]!)).toBe(state);
  });

  it('replaces a focusless tree location with the first focused one', () => {
    const loading = pushLocation(EMPTY_NAVIGATION_HISTORY, location('tree', null));
    const loaded = pushLocation(loading, location('tree', 'P1'));

    expect(loaded.entries).toEqual([location('tree', 'P1')]);
    expect(loaded.index).toBe(0);
  });

  it('caps the stack and keeps the newest entries', () => {
    let state = EMPTY_NAVIGATION_HISTORY;
    for (let index = 0; index < NAVIGATION_HISTORY_LIMIT + 3; index += 1) {
      state = pushLocation(state, location(`person:${index}`));
    }
    expect(state.entries).toHaveLength(NAVIGATION_HISTORY_LIMIT);
    expect(state.entries[0]?.tabId).toBe('person:3');
    expect(state.entries.at(-1)?.tabId).toBe(`person:${NAVIGATION_HISTORY_LIMIT + 2}`);
  });

  it('finds the nearest reachable entry in both directions', () => {
    const state = history([location('tree', 'P1'), location('person:closed'), location('tree', 'P2')], 2);
    const isReachable = (entry: NavigationLocation): boolean => entry.tabId !== 'person:closed';

    expect(backIndex(state, isReachable)).toBe(0);
    expect(forwardIndex(history(state.entries, 0), isReachable)).toBe(2);
  });

  it('distinguishes tree focus in the location key', () => {
    expect(locationKey(location('tree', 'P1'))).not.toBe(locationKey(location('tree', 'P2')));
    expect(locationKey(location('tree', 'P1'))).not.toBe(locationKey(location('person:P1')));
  });

  it('reports no targets at the edges of the history', () => {
    expect(backIndex(history([location('tree')], 0), reachable)).toBeNull();
    expect(forwardIndex(history([location('tree')], 0), reachable)).toBeNull();
  });
});

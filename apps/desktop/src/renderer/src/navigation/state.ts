/**
 * Pure navigation history for the window's Back/Forward controls. A location
 * is the active editor tab plus, for the tree tab, the focused person.
 */
export interface NavigationLocation {
  tabId: string;
  /** Focused person when `tabId` is the tree tab; null for other tabs. */
  treeFocusPersonId: string | null;
}

export interface NavigationHistory {
  entries: NavigationLocation[];
  index: number;
}

export const EMPTY_NAVIGATION_HISTORY: NavigationHistory = { entries: [], index: -1 };

/** Old entries fall off the back so the stack cannot grow without a bound. */
export const NAVIGATION_HISTORY_LIMIT = 50;

export function locationKey(location: NavigationLocation): string {
  return `${location.tabId}\u0000${location.treeFocusPersonId ?? ''}`;
}

export function sameLocation(left: NavigationLocation, right: NavigationLocation): boolean {
  return left.tabId === right.tabId && left.treeFocusPersonId === right.treeFocusPersonId;
}

/** Appends a location, drops the forward branch and caps the stack. */
export function pushLocation(history: NavigationHistory, location: NavigationLocation): NavigationHistory {
  const base = history.index < 0 ? [] : history.entries.slice(0, history.index + 1);
  const last = base[base.length - 1];
  if (last !== undefined && sameLocation(last, location)) {
    return history;
  }
  // A tree location without a focus (the snapshot is still loading, or the
  // tree was empty) gives way to the first focused location instead of
  // leaving a dead Back step behind.
  if (
    last !== undefined &&
    last.tabId === location.tabId &&
    last.treeFocusPersonId === null &&
    location.treeFocusPersonId !== null
  ) {
    const entries = [...base];
    entries[entries.length - 1] = location;
    return { entries, index: entries.length - 1 };
  }
  const entries = [...base, location];
  const trimmed =
    entries.length > NAVIGATION_HISTORY_LIMIT ? entries.slice(entries.length - NAVIGATION_HISTORY_LIMIT) : entries;
  return { entries: trimmed, index: trimmed.length - 1 };
}

export type ReachableLocation = (location: NavigationLocation) => boolean;

export function backIndex(history: NavigationHistory, isReachable: ReachableLocation): number | null {
  for (let index = history.index - 1; index >= 0; index -= 1) {
    const entry = history.entries[index];
    if (entry !== undefined && isReachable(entry)) {
      return index;
    }
  }
  return null;
}

export function forwardIndex(history: NavigationHistory, isReachable: ReachableLocation): number | null {
  for (let index = history.index + 1; index < history.entries.length; index += 1) {
    const entry = history.entries[index];
    if (entry !== undefined && isReachable(entry)) {
      return index;
    }
  }
  return null;
}

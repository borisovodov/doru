import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EMPTY_NAVIGATION_HISTORY,
  backIndex,
  forwardIndex,
  locationKey,
  pushLocation,
  type NavigationHistory,
  type NavigationLocation,
  type ReachableLocation,
} from '../navigation/state';

export interface NavigationHistoryApi {
  canGoBack: boolean;
  canGoForward: boolean;
  goBack(): void;
  goForward(): void;
  /** Restarts the history at the current location, e.g. after a project bind. */
  reset(): void;
}

/**
 * Records the active location (tab + tree focus) and drives Back/Forward.
 * Applying an entry sets a guard so the resulting state change is not
 * recorded as a brand-new navigation.
 */
export function useNavigationHistory(
  location: NavigationLocation | null,
  isReachable: ReachableLocation,
  onApply: (location: NavigationLocation) => void,
): NavigationHistoryApi {
  const [history, setHistory] = useState<NavigationHistory>(EMPTY_NAVIGATION_HISTORY);
  const historyRef = useRef(history);
  historyRef.current = history;
  const locationRef = useRef(location);
  locationRef.current = location;
  const applyingKeyRef = useRef<string | null>(null);
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;

  const currentKey = location === null ? null : locationKey(location);
  // A target equal to the current location would only move the index. That
  // happens after closing a tab (the neighbour becomes active and is recorded
  // as a new location) and must not leave Back enabled as a no-op.
  const isNavigable = useCallback<ReachableLocation>(
    (entry) => (currentKey === null || locationKey(entry) !== currentKey) && isReachable(entry),
    [currentKey, isReachable],
  );
  const isNavigableRef = useRef(isNavigable);
  isNavigableRef.current = isNavigable;

  useEffect(() => {
    if (locationRef.current === null) {
      return;
    }
    const key = locationKey(locationRef.current);
    if (applyingKeyRef.current !== null) {
      if (applyingKeyRef.current === key) {
        applyingKeyRef.current = null;
        return;
      }
      // The applied target changed shape (e.g. its person vanished); treat
      // the resulting location as a normal navigation.
      applyingKeyRef.current = null;
    }
    const next = pushLocation(historyRef.current, locationRef.current);
    if (next !== historyRef.current) {
      historyRef.current = next;
      setHistory(next);
    }
  }, [currentKey]);

  const applyIndex = useCallback((index: number) => {
    const history = historyRef.current;
    const target = history.entries[index];
    if (target === undefined || !isNavigableRef.current(target)) {
      return;
    }
    const current = locationRef.current;
    if (current === null || locationKey(current) !== locationKey(target)) {
      applyingKeyRef.current = locationKey(target);
    }
    const next = { ...history, index };
    historyRef.current = next;
    setHistory(next);
    onApplyRef.current(target);
  }, []);

  const goBack = useCallback(() => {
    const index = backIndex(historyRef.current, isNavigableRef.current);
    if (index !== null) {
      applyIndex(index);
    }
  }, [applyIndex]);

  const goForward = useCallback(() => {
    const index = forwardIndex(historyRef.current, isNavigableRef.current);
    if (index !== null) {
      applyIndex(index);
    }
  }, [applyIndex]);

  const reset = useCallback(() => {
    applyingKeyRef.current = null;
    const current = locationRef.current;
    const seeded = current === null ? EMPTY_NAVIGATION_HISTORY : pushLocation(EMPTY_NAVIGATION_HISTORY, current);
    historyRef.current = seeded;
    setHistory(seeded);
  }, []);

  const canGoBack = useMemo(() => backIndex(history, isNavigable) !== null, [history, isNavigable]);
  const canGoForward = useMemo(() => forwardIndex(history, isNavigable) !== null, [history, isNavigable]);

  return { canGoBack, canGoForward, goBack, goForward, reset };
}

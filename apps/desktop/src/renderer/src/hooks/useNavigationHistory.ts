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
  /** Drops every entry, e.g. when the window binds to another project. */
  reset(): void;
}

/**
 * Records the active location (tab + tree focus) and drives Back/Forward.
 * Applying an entry sets a guard so the resulting state change is not
 * recorded as a brand-new navigation.
 */
export function useNavigationHistory(
  location: NavigationLocation | null,
  openTabIds: ReadonlySet<string>,
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

  const isReachable = useCallback<ReachableLocation>((entry) => openTabIds.has(entry.tabId), [openTabIds]);
  const isReachableRef = useRef(isReachable);
  isReachableRef.current = isReachable;

  const currentKey = location === null ? null : locationKey(location);

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
    if (target === undefined || !isReachableRef.current(target)) {
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
    const index = backIndex(historyRef.current, isReachableRef.current);
    if (index !== null) {
      applyIndex(index);
    }
  }, [applyIndex]);

  const goForward = useCallback(() => {
    const index = forwardIndex(historyRef.current, isReachableRef.current);
    if (index !== null) {
      applyIndex(index);
    }
  }, [applyIndex]);

  const reset = useCallback(() => {
    applyingKeyRef.current = null;
    historyRef.current = EMPTY_NAVIGATION_HISTORY;
    setHistory(EMPTY_NAVIGATION_HISTORY);
  }, []);

  const canGoBack = useMemo(() => backIndex(history, isReachable) !== null, [history, isReachable]);
  const canGoForward = useMemo(() => forwardIndex(history, isReachable) !== null, [history, isReachable]);

  return { canGoBack, canGoForward, goBack, goForward, reset };
}

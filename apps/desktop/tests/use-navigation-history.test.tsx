import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { NavigationLocation } from '../src/renderer/src/navigation/state';
import { useNavigationHistory } from '../src/renderer/src/hooks/useNavigationHistory';

const tree = (personId: string | null): NavigationLocation => ({ tabId: 'tree', treeFocusPersonId: personId });
const settings: NavigationLocation = { tabId: 'settings', treeFocusPersonId: null };
const alwaysReachable = (_entry: NavigationLocation): boolean => true;

function renderNavigation(location: NavigationLocation | null, isReachable = alwaysReachable) {
  const applied: NavigationLocation[] = [];
  const hook = renderHook(
    ({ current, reachable }) =>
      useNavigationHistory(current, reachable, (target) => {
        applied.push(target);
      }),
    { initialProps: { current: location, reachable: isReachable } },
  );
  return { ...hook, applied };
}

describe('useNavigationHistory', () => {
  it('skips targets that are closed or equal to the current location', () => {
    const { result, rerender } = renderNavigation(tree('P1'));

    rerender({ current: settings, reachable: alwaysReachable });
    expect(result.current.canGoBack).toBe(true);

    rerender({ current: tree('P1'), reachable: alwaysReachable });
    expect(result.current.canGoBack).toBe(true);

    const treeOnly = (entry: NavigationLocation): boolean => entry.tabId === 'tree';
    rerender({ current: tree('P1'), reachable: treeOnly });
    // settings is closed, and the only other reachable entry is the current
    // tree location, so Back must not be offered as a no-op.
    expect(result.current.canGoBack).toBe(false);
    expect(result.current.canGoForward).toBe(false);
  });

  it('skips tree entries whose focus person no longer exists', () => {
    const { result, rerender } = renderNavigation(tree('deleted'));
    rerender({ current: settings, reachable: alwaysReachable });
    rerender({ current: settings, reachable: (entry) => entry.tabId !== 'tree' });

    expect(result.current.canGoBack).toBe(false);
  });

  it('seeds the reset history with the current location', () => {
    const { result, rerender } = renderNavigation(tree('P1'));

    act(() => result.current.reset());
    rerender({ current: settings, reachable: alwaysReachable });

    expect(result.current.canGoBack).toBe(true);
    act(() => result.current.goBack());
    rerender({ current: tree('P1'), reachable: alwaysReachable });
    expect(result.current.canGoForward).toBe(true);
  });
});

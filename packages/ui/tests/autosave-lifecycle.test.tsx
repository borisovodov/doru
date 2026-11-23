import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  AutoSaveTabProvider,
  flushAllAutoSaves,
  flushAutoSaves,
  registerAutoSaveFlush,
  useAutoSaveOnBlur,
} from '../src/lib';

function provider(tabId: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AutoSaveTabProvider tabId={tabId}>{children}</AutoSaveTabProvider>;
  };
}

describe('autosave lifecycle', () => {
  it('keeps a cancelled editor dirty and blocks closing until its delete is released', async () => {
    const dirty = { value: true };
    const save = vi.fn(async () => undefined);
    const { result, unmount } = renderHook(
      () =>
        useAutoSaveOnBlur({
          enabled: true,
          isDirty: () => dirty.value,
          save,
        }),
      { wrapper: provider('person:p1') },
    );

    act(() => result.current.cancel());
    expect(await flushAutoSaves('person:p1')).toBe(false);
    expect(save).not.toHaveBeenCalled();

    act(() => result.current.release());
    expect(await flushAutoSaves('person:p1')).toBe(true);
    unmount();
  });

  it('closes after a successful save clears the dirty state', async () => {
    const dirty = { value: true };
    const save = vi.fn(async () => {
      dirty.value = false;
    });
    const { unmount } = renderHook(
      () =>
        useAutoSaveOnBlur({
          enabled: true,
          isDirty: () => dirty.value,
          save,
        }),
      { wrapper: provider('task:t1') },
    );

    expect(await flushAutoSaves('task:t1')).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('rechecks tabs that became dirty while another tab was still saving', async () => {
    let releaseSlow!: () => void;
    const slow = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });
    const dirty = { value: false };
    const unregisterFast = registerAutoSaveFlush('person:fast', {
      flush: async () => true,
      isDirty: () => dirty.value,
    });
    const unregisterSlow = registerAutoSaveFlush('person:slow', {
      flush: async () => {
        await slow;
        return true;
      },
      isDirty: () => false,
    });

    const closing = flushAllAutoSaves();
    // Let the fast tab finish its clean check while the slow one is pending,
    // then make the fast tab dirty as if the user typed again.
    await new Promise((resolve) => setTimeout(resolve, 10));
    dirty.value = true;
    releaseSlow();

    expect(await closing).toBe(false);
    unregisterFast();
    unregisterSlow();
  });

  it('saves a draft reverted while its previous write was pending', async () => {
    const dirty = { value: true };
    let releaseFirst!: () => void;
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let saves = 0;
    const save = vi.fn(async () => {
      saves += 1;
      if (saves === 1) {
        await first;
      }
    });
    const { unmount } = renderHook(() => useAutoSaveOnBlur({ enabled: true, isDirty: () => dirty.value, save }), {
      wrapper: provider('person:p1'),
    });

    const firstFlush = flushAutoSaves('person:p1');
    expect(save).toHaveBeenCalledTimes(1);
    dirty.value = false;
    const secondFlush = flushAutoSaves('person:p1');
    releaseFirst();

    await firstFlush;
    await secondFlush;
    expect(save).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('does not report clean while a registered write is still unsettled', async () => {
    let flushes = 0;
    const unregister = registerAutoSaveFlush('task:t1', {
      flush: async () => {
        flushes += 1;
        return true;
      },
      isDirty: () => false,
      isSaving: () => flushes < 2,
    });

    expect(await flushAllAutoSaves()).toBe(true);
    expect(flushes).toBe(2);
    unregister();
  });

  it('flushes every registered tab before a window closes', async () => {
    const firstDirty = { value: true };
    const secondDirty = { value: true };
    const first = renderHook(
      () =>
        useAutoSaveOnBlur({
          enabled: true,
          isDirty: () => firstDirty.value,
          save: async () => {
            firstDirty.value = false;
          },
        }),
      { wrapper: provider('person:p1') },
    );
    const second = renderHook(
      () =>
        useAutoSaveOnBlur({
          enabled: true,
          isDirty: () => secondDirty.value,
          save: async () => {
            secondDirty.value = false;
          },
        }),
      { wrapper: provider('person:p2') },
    );

    expect(await flushAllAutoSaves()).toBe(true);
    expect(firstDirty.value).toBe(false);
    expect(secondDirty.value).toBe(false);
    first.unmount();
    second.unmount();
  });
});

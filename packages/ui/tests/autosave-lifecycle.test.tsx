import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AutoSaveTabProvider, flushAllAutoSaves, flushAutoSaves, useAutoSaveOnBlur } from '../src/lib';

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

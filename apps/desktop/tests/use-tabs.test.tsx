import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { PersonRecord } from '@doru/core';
import { registerAutoSaveFlush } from '@doru/ui';
import { nls } from '@doru/workbench';
import { useTabs } from '../src/renderer/src/hooks/useTabs';

const ada: PersonRecord = {
  id: 'p1',
  sex: 'F',
  names: [{ id: 'n1', given: 'Ada', surname: 'Lovelace' }],
  facts: [],
};

function renderTabs() {
  return renderHook(() => useTabs([ada], [], [], [], [], [], [], [], [], []));
}

describe('useTabs', () => {
  it('opens entity tabs through the generated openers', () => {
    const { result } = renderTabs();

    act(() => result.current.open.person('p1'));
    expect(result.current.openTabs).toEqual([{ id: 'person:p1', closable: true }]);
    expect(result.current.activeTabId).toBe('person:p1');
    expect(result.current.tabInfos[0]?.label).toBe('Ada Lovelace');

    act(() => result.current.open.media('m1'));
    expect(result.current.openTabs.map((tab) => tab.id)).toEqual(['person:p1', 'media:m1']);
  });

  it('creates new records and static tabs', () => {
    const { result } = renderTabs();

    act(() => result.current.openNew.task());
    expect(result.current.activeTabId).toMatch(/^task:new:/);
    expect(result.current.tabInfos[0]?.label).toBe(nls.t('features.tasks.newTask'));

    act(() => result.current.openStatic.export());
    expect(result.current.activeTabId).toBe('export');
    expect(result.current.tabInfos[1]?.label).toBe(nls.t('workbench.exportGedcom'));
  });

  it('keeps a tab open when its close-time save fails', async () => {
    const { result } = renderTabs();
    act(() => result.current.open.person('p1'));

    const unregisterFailure = registerAutoSaveFlush('person:p1', {
      flush: async () => false,
      isDirty: () => true,
    });
    await act(async () => {
      result.current.closeTab('person:p1');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.openTabs).toHaveLength(1);
    unregisterFailure();

    const unregisterSuccess = registerAutoSaveFlush('person:p1', {
      flush: async () => true,
      isDirty: () => false,
    });
    await act(async () => {
      result.current.closeTab('person:p1');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.openTabs).toHaveLength(0);
    unregisterSuccess();
  });

  it('resets to the tree tab and closes back to it', () => {
    const { result } = renderTabs();

    act(() => result.current.open.person('p1'));
    act(() => result.current.resetToTree());
    expect(result.current.openTabs.map((tab) => tab.id)).toEqual(['tree']);

    act(() => result.current.closeTab('tree'));
    expect(result.current.openTabs).toEqual([]);
    expect(result.current.activeTabId).toBeNull();
  });
});

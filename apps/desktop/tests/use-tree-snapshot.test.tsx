import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { FamilyRecord, PersonRecord, RecordSubmitterLink, TagLinkRecord, TagRecord } from '@doru/core';
import { useTreeSnapshot } from '../src/renderer/src/hooks/tree/useTreeSnapshot';

const ada: PersonRecord = {
  id: 'p1',
  sex: 'F',
  names: [{ id: 'n1', given: 'Ada', surname: 'Lovelace' }],
  facts: [],
};

const grace: PersonRecord = {
  id: 'p2',
  sex: 'F',
  names: [{ id: 'n2', given: 'Grace', surname: 'Hopper' }],
  facts: [],
};

const recordSubmitters: RecordSubmitterLink[] = [
  { id: 'rs1', submitterId: 'su1', targetType: 'person', targetId: 'p1', kind: 'contributor' },
];
const tags: TagRecord[] = [{ id: 'tag1', name: 'Family' }];
const tagLinks: TagLinkRecord[] = [{ id: 'tl1', tagId: 'tag1', targetType: 'person', targetId: 'p1' }];

type TreeData = { persons: PersonRecord[]; families: FamilyRecord[] };

const originalDoru = window.doru;

afterEach(() => {
  window.doru = originalDoru;
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function installDoru(all?: () => Promise<TreeData>) {
  const callbacks = new Set<() => void>();
  let loadCount = 0;
  const empty = async () => [];
  const fake = {
    all: async () => {
      loadCount += 1;
      return all !== undefined ? all() : { persons: [ada], families: [] };
    },
    getAllFacts: empty,
    getSources: empty,
    getAllMedia: empty,
    getAllCitations: empty,
    listNotes: empty,
    getPlaces: empty,
    getRepositories: empty,
    getSubmitters: empty,
    getAllRecordSubmitters: async () => recordSubmitters,
    getTags: async () => tags,
    getAllTagLinks: async () => tagLinks,
    listAddresses: empty,
    getTodos: empty,
    getTitles: empty,
    getAllAssociations: empty,
    onTreeExternalChange: (callback: () => void) => {
      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },
  };
  window.doru = fake as unknown as typeof window.doru;
  return {
    callbacks,
    loadCount: () => loadCount,
  };
}

describe('useTreeSnapshot', () => {
  it('loads the tree and refreshes on demand and on external changes', async () => {
    const doru = installDoru();
    const { result } = renderHook(() => useTreeSnapshot('tree.doru'));

    await waitFor(() => expect(result.current.persons).toEqual([ada]));
    expect(result.current.recordSubmitters).toEqual(recordSubmitters);
    expect(result.current.tags).toEqual(tags);
    expect(result.current.tagLinks).toEqual(tagLinks);
    expect(doru.loadCount()).toBe(1);

    await act(async () => result.current.refreshTree());
    expect(doru.loadCount()).toBe(2);

    await act(async () => {
      for (const callback of doru.callbacks) {
        callback();
      }
    });
    await waitFor(() => expect(doru.loadCount()).toBe(3));
  });

  it('clears the snapshot when the project goes away', async () => {
    installDoru();
    const { result, rerender } = renderHook<ReturnType<typeof useTreeSnapshot>, { path: string | null }>(
      ({ path }) => useTreeSnapshot(path),
      { initialProps: { path: 'tree.doru' } },
    );

    await waitFor(() => expect(result.current.persons).toEqual([ada]));
    expect(result.current.recordSubmitters).toEqual(recordSubmitters);
    expect(result.current.tags).toEqual(tags);
    expect(result.current.tagLinks).toEqual(tagLinks);

    rerender({ path: null });
    expect(result.current.persons).toEqual([]);
    expect(result.current.families).toEqual([]);
    expect(result.current.recordSubmitters).toEqual([]);
    expect(result.current.tags).toEqual([]);
    expect(result.current.tagLinks).toEqual([]);
  });

  it('ignores an older reload that resolves after a newer one', async () => {
    const first = deferred<TreeData>();
    const second = deferred<TreeData>();
    const responses = [first, second];
    const doru = installDoru(() => responses.shift()!.promise);
    const { result } = renderHook(() => useTreeSnapshot('tree.doru'));

    await waitFor(() => expect(doru.loadCount()).toBe(1));
    const refresh = result.current.refreshTree();
    await waitFor(() => expect(doru.loadCount()).toBe(2));

    second.resolve({ persons: [grace], families: [] });
    // The awaited refresh must not finish before its replacement publishes.
    await act(async () => {
      await refresh;
    });
    expect(result.current.persons).toEqual([grace]);

    first.resolve({ persons: [ada], families: [] });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.persons).toEqual([grace]);
  });

  it('unsubscribes from external changes on unmount', async () => {
    const doru = installDoru();
    const { unmount } = renderHook(() => useTreeSnapshot('tree.doru'));

    await waitFor(() => expect(doru.callbacks.size).toBe(1));
    unmount();
    expect(doru.callbacks.size).toBe(0);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { MediaTargetApi } from '@doru/features/person';
import { usePersonEditorApi } from '../src/renderer/src/hooks/tree/usePersonEditorApi';
import { stubApi } from '../../../test/ui/harness';

const originalDoru = window.doru;

afterEach(() => {
  window.doru = originalDoru;
});

describe('usePersonEditorApi', () => {
  it('lets tag attachment continue when the post-write reload fails', async () => {
    const addTag = vi.fn(async () => {});
    window.doru = { addTag } as never;
    const refreshTree = vi.fn(async () => {
      throw new Error('reload failed');
    });
    const mediaApi = stubApi<MediaTargetApi>({});
    const { result } = renderHook(() => usePersonEditorApi('/tmp/tree.doru', refreshTree, mediaApi));

    await expect(result.current.addTag({ id: 'T1', name: 'Family' })).resolves.toBeUndefined();
    expect(addTag).toHaveBeenCalledWith('/tmp/tree.doru', { id: 'T1', name: 'Family' });
    expect(refreshTree).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { MediaRecord } from '@doru/core';
import { useMediaApis } from '../src/renderer/src/hooks/tree/useMediaApis';

const record: MediaRecord = { id: 'M1' };

describe('useMediaApis', () => {
  it('keeps a committed media write successful when the tree refresh fails', async () => {
    const updateMedia = vi.fn(async () => undefined);
    window.doru = {
      updateMedia,
    } as unknown as typeof window.doru;
    const refreshTree = vi.fn(async () => {
      throw new Error('refresh failed');
    });

    const { result } = renderHook(() => useMediaApis('/project.doru', refreshTree));

    await act(async () => {
      await expect(
        result.current.mediaAdminApi.updateMedia(record, { ...record, title: 'New' }),
      ).resolves.toBeUndefined();
    });
    expect(updateMedia).toHaveBeenCalledTimes(1);
    expect(refreshTree).toHaveBeenCalledTimes(1);
  });
});

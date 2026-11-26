import { useCallback, useMemo } from 'react';
import type { TargetRef } from '@doru/core';
import type { MediaAdminApi, MediaTargetApi } from '@doru/features';
import type { RefreshTree } from './types';

// Writes are committed by the main process; a failed tree refresh must not
// turn a successful write into a save failure in the editor.
async function refreshAfterWrite(refreshTree: RefreshTree): Promise<void> {
  try {
    await refreshTree();
  } catch {
    // The next successful refresh will catch up.
  }
}

export function useMediaApis(projectPath: string | null | undefined, refreshTree: RefreshTree) {
  const addStandaloneMedia = useCallback(async () => {
    if (!projectPath) return;
    await window.doru.addStandaloneMedia(projectPath);
    await refreshAfterWrite(refreshTree);
  }, [projectPath, refreshTree]);

  const mediaApi = useMemo<MediaTargetApi>(
    () => ({
      getMediaFor: (targetType, targetId) =>
        projectPath ? window.doru.getMedia(projectPath, targetType, targetId) : Promise.resolve([]),
      getAllMedia: () => (projectPath ? window.doru.getAllMedia(projectPath) : Promise.resolve([])),
      addMediaToTarget: async (targetType, targetId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addMedia(projectPath, targetType, targetId);
        await refreshAfterWrite(refreshTree);
      },
      attachMedia: async (link) => {
        if (!projectPath) {
          return;
        }
        await window.doru.attachMedia(projectPath, link);
        await refreshAfterWrite(refreshTree);
      },
      attachMediaToTargets: async (mediaId: string, targets: TargetRef[]) => {
        if (!projectPath) {
          return;
        }
        await window.doru.attachMediaToTargets(projectPath, mediaId, targets);
        await refreshAfterWrite(refreshTree);
      },
      detachMedia: async (link) => {
        if (!projectPath) {
          return;
        }
        await window.doru.detachMedia(projectPath, link);
        await refreshAfterWrite(refreshTree);
      },
      deleteMedia: async (media) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteMedia(projectPath, media);
        await refreshAfterWrite(refreshTree);
      },
    }),
    [projectPath, refreshTree],
  );

  const mediaAdminApi = useMemo<MediaAdminApi>(
    () => ({
      ...mediaApi,
      getMedia: async (id) => {
        if (!projectPath) {
          return undefined;
        }
        const all = await window.doru.getAllMedia(projectPath);
        return all.find((media) => media.id === id);
      },
      updateMedia: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateMedia(projectPath, before, after);
        await refreshAfterWrite(refreshTree);
      },
      updateMediaLink: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateMediaLink(projectPath, before, after);
        await refreshAfterWrite(refreshTree);
      },
    }),
    [mediaApi, projectPath, refreshTree],
  );
  return { addStandaloneMedia, mediaApi, mediaAdminApi };
}

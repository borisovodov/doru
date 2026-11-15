import { useCallback, useMemo } from 'react';
import type { MediaFile } from '@doru/core';
import type { MediaAdminApi, MediaTargetApi } from '@doru/features';
import type { RefreshTree } from './types';

export function useMediaApis(projectPath: string | null | undefined, refreshTree: RefreshTree) {
  const addStandaloneMedia = useCallback(async () => {
    if (!projectPath) return;
    await window.doru.addStandaloneMedia(projectPath);
    await refreshTree();
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
        await refreshTree();
      },
      attachMedia: async (link) => {
        if (!projectPath) {
          return;
        }
        await window.doru.attachMedia(projectPath, link);
        await refreshTree();
      },
      detachMedia: async (link) => {
        if (!projectPath) {
          return;
        }
        await window.doru.detachMedia(projectPath, link);
        await refreshTree();
      },
      deleteMedia: async (media) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteMedia(projectPath, media);
        await refreshTree();
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
        await refreshTree();
      },
      addMediaFile: async (mediaId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addMediaFile(projectPath, mediaId);
        await refreshTree();
      },
      removeMediaFile: async (media, file: MediaFile) => {
        if (!projectPath) {
          return;
        }
        await window.doru.removeMediaFile(projectPath, media, file);
        await refreshTree();
      },
      updateMediaLink: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateMediaLink(projectPath, before, after);
        await refreshTree();
      },
    }),
    [mediaApi, projectPath, refreshTree],
  );
  return { addStandaloneMedia, mediaApi, mediaAdminApi };
}

import { useMemo } from 'react';
import type { PlaceEditorApi } from '@doru/features';
import type { RefreshTree } from './types';
import type { useAttachmentMethods } from './useAttachmentMethods';

export function usePlaceEditorApi(
  projectPath: string | null | undefined,
  refreshTree: RefreshTree,
  attachmentMethods: ReturnType<typeof useAttachmentMethods>,
): PlaceEditorApi {
  const placeApi = useMemo<PlaceEditorApi>(
    () => ({
      ...attachmentMethods,
      getPlaces: () => (projectPath ? window.doru.getPlaces(projectPath) : Promise.resolve([])),
      addPlace: async (place) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addPlace(projectPath, place);
        await refreshTree();
      },
      updatePlace: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updatePlace(projectPath, before, after);
        await refreshTree();
      },
      deletePlace: async (place) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deletePlace(projectPath, place);
        await refreshTree();
      },
    }),
    [projectPath, refreshTree, attachmentMethods],
  );
  return placeApi;
}

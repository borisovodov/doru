import { useMemo } from 'react';
import type { SubmitterRecord } from '@doru/core';
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
      getSubmitters: () =>
        projectPath ? window.doru.getSubmitters(projectPath) : Promise.resolve([] as SubmitterRecord[]),
      getRecordSubmitters: (targetType: string, targetId: string) =>
        projectPath
          ? window.doru.getRecordSubmitters(projectPath, targetType, targetId)
          : Promise.resolve([] as Array<{ id: string; submitterId: string; targetType: string; targetId: string }>),
      addRecordSubmitter: async (submitterId: string, targetType: string, targetId: string) => {
        if (!projectPath) return;
        await window.doru.addRecordSubmitter(projectPath, submitterId, targetType, targetId);
        await refreshTree();
      },
      deleteRecordSubmitter: async (id: string, submitterId: string, targetType: string, targetId: string) => {
        if (!projectPath) return;
        await window.doru.deleteRecordSubmitter(projectPath, id, submitterId, targetType, targetId);
        await refreshTree();
      },
    }),
    [projectPath, refreshTree, attachmentMethods],
  );
  return placeApi;
}

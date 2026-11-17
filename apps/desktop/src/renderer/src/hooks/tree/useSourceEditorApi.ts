import { useMemo } from 'react';
import type { SubmitterRecord } from '@doru/core';
import type { SourceEditorApi } from '@doru/features';
import type { RefreshTree } from './types';
import type { useAttachmentMethods } from './useAttachmentMethods';

export function useSourceEditorApi(
  projectPath: string | null | undefined,
  refreshTree: RefreshTree,
  attachmentMethods: ReturnType<typeof useAttachmentMethods>,
): SourceEditorApi {
  const sourceApi = useMemo<SourceEditorApi>(
    () => ({
      ...attachmentMethods,
      updateSource: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateSource(projectPath, before, after);
        await refreshTree();
      },
      deleteSource: async (source) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteSource(projectPath, source);
        await refreshTree();
      },
      getRepositories: () => (projectPath ? window.doru.getRepositories(projectPath) : Promise.resolve([])),
      addRepository: async (repository) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addRepository(projectPath, repository);
        await refreshTree();
      },
      getTitles: () => (projectPath ? window.doru.getTitles(projectPath) : Promise.resolve([])),
      getSubmitters: () =>
        projectPath ? window.doru.getSubmitters(projectPath) : Promise.resolve([] as SubmitterRecord[]),
      getRecordSubmitters: (targetType: string, targetId: string) =>
        projectPath
          ? window.doru.getRecordSubmitters(projectPath, targetType, targetId)
          : Promise.resolve([] as Array<{ id: string; submitterId: string; targetType: string; targetId: string }>),
      addRecordSubmitter: async (
        submitterId: string,
        targetType: string,
        targetId: string,
        kind: 'contributor' | 'ancestor_interest' | 'descendant_interest' = 'contributor',
      ) => {
        if (!projectPath) return;
        await window.doru.addRecordSubmitter(projectPath, submitterId, targetType, targetId, kind);
        await refreshTree();
      },
      deleteRecordSubmitter: async (
        id: string,
        submitterId: string,
        targetType: string,
        targetId: string,
        kind: 'contributor' | 'ancestor_interest' | 'descendant_interest' = 'contributor',
      ) => {
        if (!projectPath) return;
        await window.doru.deleteRecordSubmitter(projectPath, id, submitterId, targetType, targetId, kind);
        await refreshTree();
      },
    }),
    [projectPath, refreshTree, attachmentMethods],
  );
  return sourceApi;
}

import { useMemo } from 'react';
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
    }),
    [projectPath, refreshTree, attachmentMethods],
  );
  return sourceApi;
}

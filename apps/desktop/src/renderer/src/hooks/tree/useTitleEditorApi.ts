import { useMemo } from 'react';
import type { TitleRecord } from '@doru/core';
import type { TitleEditorApi } from '@doru/features';
import type { RefreshTree } from './types';
import type { useAttachmentMethods } from './useAttachmentMethods';

export function useTitleEditorApi(
  projectPath: string | null | undefined,
  refreshTree: RefreshTree,
  attachmentMethods: ReturnType<typeof useAttachmentMethods>,
): TitleEditorApi {
  const titlesApi = useMemo<TitleEditorApi>(
    () => ({
      ...attachmentMethods,
      getSubmitters: () => (projectPath ? window.doru.getSubmitters(projectPath) : Promise.resolve([])),
      getRecordSubmitters: (targetType, targetId) =>
        projectPath ? window.doru.getRecordSubmitters(projectPath, targetType, targetId) : Promise.resolve([]),
      addRecordSubmitter: async (submitterId, targetType, targetId) => {
        if (!projectPath) return;
        await window.doru.addRecordSubmitter(projectPath, submitterId, targetType, targetId);
        await refreshTree();
      },
      deleteRecordSubmitter: async (id, submitterId, targetType, targetId) => {
        if (!projectPath) return;
        await window.doru.deleteRecordSubmitter(projectPath, id, submitterId, targetType, targetId);
        await refreshTree();
      },
      addTitle: async (title: TitleRecord) => {
        if (!projectPath) return;
        await window.doru.addTitle(projectPath, title);
        await refreshTree();
      },
      updateTitle: async (before: TitleRecord, after: TitleRecord) => {
        if (!projectPath) return;
        await window.doru.updateTitle(projectPath, before, after);
        await refreshTree();
      },
      deleteTitle: async (title: TitleRecord) => {
        if (!projectPath) return;
        await window.doru.deleteTitle(projectPath, title);
        await refreshTree();
      },
    }),
    [projectPath, refreshTree, attachmentMethods],
  );
  return titlesApi;
}

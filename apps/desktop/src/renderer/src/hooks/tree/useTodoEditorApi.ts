import { useMemo } from 'react';
import type { TodoEditorApi } from '@doru/features';
import type { RefreshTree } from './types';
import type { useAttachmentMethods } from './useAttachmentMethods';

export function useTodoEditorApi(
  projectPath: string | null | undefined,
  refreshTree: RefreshTree,
  attachmentMethods: ReturnType<typeof useAttachmentMethods>,
): TodoEditorApi {
  const todosApi = useMemo<TodoEditorApi>(
    () => ({
      ...attachmentMethods,
      getSubmitters: () => (projectPath ? window.doru.getSubmitters(projectPath) : Promise.resolve([])),
      getRecordSubmitters: (targetType, targetId) =>
        projectPath ? window.doru.getRecordSubmitters(projectPath, targetType, targetId) : Promise.resolve([]),
      addRecordSubmitter: async (
        submitterId,
        targetType,
        targetId,
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
  return todosApi;
}

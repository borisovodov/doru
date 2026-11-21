import { useMemo } from 'react';
import type { TaskEditorApi } from '@doru/features';
import type { RefreshTree } from './types';
import type { useAttachmentMethods } from './useAttachmentMethods';

export function useTaskEditorApi(
  projectPath: string | null | undefined,
  refreshTree: RefreshTree,
  attachmentMethods: ReturnType<typeof useAttachmentMethods>,
): TaskEditorApi {
  const tasksApi = useMemo<TaskEditorApi>(
    () => ({
      ...attachmentMethods,
    }),
    [projectPath, refreshTree, attachmentMethods],
  );
  return tasksApi;
}

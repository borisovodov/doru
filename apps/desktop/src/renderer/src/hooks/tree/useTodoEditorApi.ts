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
    }),
    [projectPath, refreshTree, attachmentMethods],
  );
  return todosApi;
}

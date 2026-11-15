import { useCallback } from 'react';
import type { RefreshTree } from './types';

export function useTreeHistory(projectPath: string | null | undefined, refreshTree: RefreshTree) {
  const undo = useCallback(async () => {
    if (!projectPath) {
      return;
    }
    await window.doru.undo(projectPath);
    void refreshTree();
  }, [projectPath, refreshTree]);

  const redo = useCallback(async () => {
    if (!projectPath) {
      return;
    }
    await window.doru.redo(projectPath);
    void refreshTree();
  }, [projectPath, refreshTree]);

  return { undo, redo };
}

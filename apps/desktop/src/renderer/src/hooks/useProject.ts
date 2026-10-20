import { useCallback, useEffect, useState } from 'react';
import type { RecentProject } from '@doru/core';

export function useProject(
  projectPath: string | null | undefined,
  refreshTree: () => Promise<void>,
  ensureTreeTab: () => void,
) {
  const [recent, setRecent] = useState<RecentProject[]>([]);

  const refreshRecent = useCallback(async () => {
    setRecent(await window.doru.recentProjects());
  }, []);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  const openProject = useCallback(
    async (path?: string) => {
      if (path) {
        const summary = await window.doru.openProjectPath(path);
        if (summary && projectPath && summary.path === projectPath) {
          ensureTreeTab();
        }
      } else {
        await window.doru.openProjectDialog();
      }
      void refreshRecent();
    },
    [projectPath, refreshRecent, ensureTreeTab],
  );

  const createProject = useCallback(async () => {
    await window.doru.createProjectDialog();
    void refreshRecent();
  }, [refreshRecent]);

  const saveProject = useCallback(async () => {
    if (!projectPath) {
      return;
    }
    await window.doru.saveProject(projectPath);
    void refreshRecent();
  }, [projectPath, refreshRecent]);

  const importGedcom = useCallback(async () => {
    if (!projectPath) {
      return;
    }
    const result = await window.doru.importGedcom(projectPath);
    if (result) {
      void refreshTree();
    }
  }, [projectPath, refreshTree]);

  const exportGedcom = useCallback(async () => {
    if (!projectPath) {
      return;
    }
    await window.doru.exportGedcom(projectPath);
  }, [projectPath]);

  return {
    recent,
    refreshRecent,
    openProject,
    createProject,
    saveProject,
    importGedcom,
    exportGedcom,
  };
}

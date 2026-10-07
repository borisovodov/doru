import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GedcomImportResult, ProjectSummary, RecentProject } from '@doru/core';
import { CommandService } from '@doru/platform';
import { RecentList, TreeView } from '@doru/features';
import { Workbench, nls, type TabInfo } from '@doru/workbench';

export function App() {
  const [tabs, setTabs] = useState<ProjectSummary[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [importResult, setImportResult] = useState<GedcomImportResult | null>(null);
  const commands = useMemo(() => new CommandService(), []);

  const refreshRecent = useCallback(async () => {
    setRecent(await window.doru.recentProjects());
  }, []);

  const openProject = useCallback(
    async (path?: string) => {
      const result = path ? await window.doru.openProjectPath(path) : await window.doru.openProjectDialog();
      if (!result) {
        return;
      }
      setTabs((previous) =>
        previous.some((tab) => tab.path === result.path) ? previous : [...previous, result],
      );
      setActivePath(result.path);
      setImportResult(null);
      void refreshRecent();
    },
    [refreshRecent],
  );

  const closeTab = useCallback(
    async (path: string) => {
      await window.doru.closeProject(path);
      setTabs((previous) => previous.filter((tab) => tab.path !== path));
      setActivePath((current) => {
        if (current !== path) {
          return current;
        }
        const remaining = tabs.filter((tab) => tab.path !== path);
        return remaining.length > 0 ? (remaining[remaining.length - 1]?.path ?? null) : null;
      });
    },
    [tabs],
  );

  const importGedcom = useCallback(async () => {
    if (!activePath) {
      return;
    }
    const result = await window.doru.importGedcom(activePath);
    setImportResult(result);
  }, [activePath]);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  useEffect(() => {
    return window.doru.onExternalOpen((summary) => {
      setTabs((previous) =>
        previous.some((tab) => tab.path === summary.path) ? previous : [...previous, summary],
      );
      setActivePath(summary.path);
      void refreshRecent();
    });
  }, [refreshRecent]);

  useEffect(() => {
    return commands
      .register({
        id: 'workbench.openProject',
        title: nls.t('workbench.openProject'),
        handler: () => openProject(),
      })
      .dispose;
  }, [commands, openProject]);

  const activeSummary = tabs.find((tab) => tab.path === activePath) ?? null;
  const tabInfos: TabInfo[] = tabs.map((tab) => ({ id: tab.path, label: basename(tab.path) }));

  return (
    <Workbench
      commands={commands}
      sidebar={<RecentList projects={recent} onOpen={(path) => void openProject(path)} onBrowse={() => void openProject()} />}
      editor={
        <TreeView
          summary={activeSummary}
          importResult={activeSummary ? importResult : null}
          onOpenProject={() => void openProject()}
          onImportGedcom={() => void importGedcom()}
        />
      }
      tabs={tabInfos}
      activeTabId={activePath}
      onSelectTab={setActivePath}
      onCloseTab={(id) => void closeTab(id)}
      statusText={activeSummary ? activeSummary.path : nls.t('workbench.statusBar.ready')}
      onOpenProject={() => void openProject()}
    />
  );
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

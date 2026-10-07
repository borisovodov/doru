import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GedcomImportResult, ProjectSummary } from '@doru/core';
import { CommandService } from '@doru/platform';
import { TreeView } from '@doru/features';
import { Workbench, nls } from '@doru/workbench';

export function App() {
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [importResult, setImportResult] = useState<GedcomImportResult | null>(null);
  const commands = useMemo(() => new CommandService(), []);

  const openProject = useCallback(async () => {
    const result = await window.doru.openProjectDialog();
    if (result) {
      setSummary(result);
      setImportResult(null);
    }
  }, []);

  const importGedcom = useCallback(async () => {
    if (!summary) {
      return;
    }
    const result = await window.doru.importGedcom(summary.path);
    setImportResult(result);
  }, [summary]);

  useEffect(() => {
    return commands
      .register({
        id: 'workbench.openProject',
        title: nls.t('workbench.openProject'),
        handler: openProject,
      })
      .dispose;
  }, [commands, openProject]);

  return (
    <Workbench
      commands={commands}
      sidebar={
        <TreeView
          summary={summary}
          importResult={importResult}
          onOpenProject={openProject}
          onImportGedcom={importGedcom}
        />
      }
      editor={
        <TreeView
          summary={summary}
          importResult={importResult}
          onOpenProject={openProject}
          onImportGedcom={importGedcom}
        />
      }
      statusText={summary ? summary.path : nls.t('workbench.statusBar.ready')}
      onOpenProject={openProject}
    />
  );
}

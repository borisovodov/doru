import type { ProjectSummary } from '@doru/core';
import { LocalizationService } from '@doru/platform';

const detected =
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ru')
    ? 'ru'
    : 'en';

const nls = new LocalizationService(detected);

export interface TreeViewProps {
  summary?: ProjectSummary | null;
  onOpenProject: () => void;
}

export function TreeView({ summary, onOpenProject }: TreeViewProps) {
  if (!summary) {
    return (
      <div className="tree-view">
        <h2>{nls.t('features.tree.title')}</h2>
        <p>{nls.t('workbench.tree.empty')}</p>
        <button onClick={onOpenProject}>{nls.t('workbench.openProject')}</button>
      </div>
    );
  }

  return (
    <div className="tree-view">
      <h2>{nls.t('features.tree.title')}</h2>
      <dl>
        <dt>Project</dt>
        <dd>{summary.path}</dd>
        <dt>Tree file</dt>
        <dd>{summary.treePath}</dd>
        <dt>Schema version</dt>
        <dd>{summary.schemaVersion}</dd>
      </dl>
      {summary.created.length > 0 && <p>Created: {summary.created.join(', ')}</p>}
      {summary.healed.length > 0 && <p>Healed: {summary.healed.join(', ')}</p>}
    </div>
  );
}

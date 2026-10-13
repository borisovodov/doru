import { useState } from 'react';
import type {
  GedcomImportResult,
  PersonRecord,
  TreeStats,
} from '@doru/core';
import { nls } from '../nls';
import { PersonList } from '../person/PersonList';

export interface TreeViewProps {
  persons: PersonRecord[];
  stats?: TreeStats | null;
  importResult?: GedcomImportResult | null;
  exportResult?: { path: string } | null;
  search: string;
  canUndo: boolean;
  canRedo: boolean;
  onSearch: (query: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onImportGedcom: () => void;
  onExportGedcom: () => void;
  onAddPerson: () => void;
  onOpenPerson: (personId: string) => void;
  getGedcomText: () => Promise<string>;
}

export function TreeView({
  persons,
  stats,
  importResult,
  exportResult,
  search,
  canUndo,
  canRedo,
  onSearch,
  onUndo,
  onRedo,
  onImportGedcom,
  onExportGedcom,
  onAddPerson,
  onOpenPerson,
  getGedcomText,
}: TreeViewProps) {
  const [viewMode, setViewMode] = useState<'tree' | 'gedcom'>('tree');
  const [gedcomText, setGedcomText] = useState<string | null>(null);

  const toggleGedcom = async () => {
    if (viewMode === 'tree') {
      setViewMode('gedcom');
      setGedcomText(null);
      setGedcomText(await getGedcomText());
    } else {
      setViewMode('tree');
      setGedcomText(null);
    }
  };

  return (
    <div className="tree-view">
      <div className="tree-toolbar">
        <input
          value={search}
          placeholder={nls.t('features.tree.search.placeholder')}
          onChange={(event) => onSearch(event.target.value)}
        />
        <button disabled={!canUndo} onClick={onUndo} title="Cmd+Z / Ctrl+Z">
          {nls.t('workbench.undo')}
        </button>
        <button disabled={!canRedo} onClick={onRedo} title="Shift+Cmd+Z / Ctrl+Shift+Z">
          {nls.t('workbench.redo')}
        </button>
        <button onClick={onImportGedcom}>{nls.t('features.tree.importGedcom')}</button>
        <button onClick={onExportGedcom}>{nls.t('features.tree.exportGedcom')}</button>
        <button onClick={onAddPerson}>{nls.t('features.tree.addPerson')}</button>
        <button onClick={() => void toggleGedcom()}>
          {viewMode === 'tree' ? nls.t('features.tree.viewGedcom') : nls.t('features.tree.viewPeople')}
        </button>
      </div>
      {viewMode === 'gedcom' ? (
        <pre className="gedcom-view">{gedcomText ?? ''}</pre>
      ) : (
        <>
          {stats && (
            <p className="tree-stats">{nls.t('features.tree.totalPersons', stats.persons)}</p>
          )}
          {importResult && (
            <p className="tree-stats">
              {nls.t(
                'features.tree.importResult',
                importResult.importedPersons,
                importResult.importedFamilies,
              )}
            </p>
          )}
          {exportResult && (
            <p className="tree-stats">{nls.t('features.tree.exported', exportResult.path)}</p>
          )}
          <PersonList persons={persons} onOpen={onOpenPerson} />
        </>
      )}
    </div>
  );
}

import type { GedcomImportResult, PersonRecord, ProjectSummary, TreeStats } from '@doru/core';
import { LocalizationService } from '@doru/platform';

const detected =
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ru')
    ? 'ru'
    : 'en';

const nls = new LocalizationService(detected);

export interface TreeViewProps {
  summary?: ProjectSummary | null;
  persons: PersonRecord[];
  stats?: TreeStats | null;
  importResult?: GedcomImportResult | null;
  search: string;
  canUndo: boolean;
  canRedo: boolean;
  onOpenProject: () => void;
  onImportGedcom: () => void;
  onSearch: (query: string) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function TreeView({
  summary,
  persons,
  stats,
  importResult,
  search,
  canUndo,
  canRedo,
  onOpenProject,
  onImportGedcom,
  onSearch,
  onUndo,
  onRedo,
}: TreeViewProps) {
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
      </div>
      {stats && <p className="tree-stats">{nls.t('features.tree.totalPersons', stats.persons)}</p>}
      {importResult && (
        <p className="tree-stats">
          {nls.t('features.tree.importResult', importResult.importedPersons, importResult.importedFamilies)}
        </p>
      )}
      {persons.length === 0 ? (
        <p>{nls.t('features.tree.emptyTree')}</p>
      ) : (
        <ul className="person-list">
          {persons.map((person) => (
            <li key={person.id}>
              <span className="person-name">{displayName(person)}</span>
              <span className="person-dates">{years(person)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function displayName(person: PersonRecord): string {
  const name = person.names[0];
  if (!name) {
    return person.id;
  }
  if (name.full) {
    return name.full;
  }
  const parts = [name.given, name.surname].filter((part) => part !== undefined);
  return parts.length > 0 ? parts.join(' ') : person.id;
}

function years(person: PersonRecord): string {
  const parts: string[] = [];
  if (person.birth?.year !== undefined) {
    parts.push(`${qualityMark(person.birth.quality)}${person.birth.year}`);
  }
  if (person.death?.year !== undefined) {
    parts.push(`— ${person.death.year}`);
  }
  return parts.join(' ');
}

function qualityMark(quality: 'exact' | 'about' | 'before' | 'after' | 'range' | 'unknown'): string {
  switch (quality) {
    case 'about':
      return '~';
    case 'before':
      return '<';
    case 'after':
      return '>';
    default:
      return '';
  }
}

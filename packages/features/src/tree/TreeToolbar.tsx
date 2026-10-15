import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, Search } from 'lucide-react';
import type { ChartKind, PersonRecord } from '@doru/core';
import { nls } from '../nls';
import { displayName } from '../person/format';

const CHART_KINDS = [
  { kind: 'ancestors', key: 'tree.canvas.view.ancestors' },
  { kind: 'descendants', key: 'tree.canvas.view.descendants' },
  { kind: 'hourglass', key: 'tree.canvas.view.hourglass' },
  { kind: 'family', key: 'tree.canvas.view.family' },
] as const satisfies ReadonlyArray<{ kind: ChartKind; key: string }>;

export interface TreeToolbarProps {
  kind: ChartKind;
  onKindChange(kind: ChartKind): void;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack(): void;
  onForward(): void;
  onCollapseAll(): void;
  onExpandAll(): void;
  /** Focus history trail (person ids), newest last. */
  breadcrumbs: string[];
  focusPersonId: string | undefined;
  persons: PersonRecord[];
  onJump(index: number): void;
  searchQuery: string;
  onSearchQueryChange(query: string): void;
  onSearchSelect(personId: string): void;
}

/**
 * The canvas toolbar: chart kind switch, focus history, collapse controls
 * and the person search box.
 */
export function TreeToolbar({
  kind,
  onKindChange,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onCollapseAll,
  onExpandAll,
  breadcrumbs,
  focusPersonId,
  persons,
  onJump,
  searchQuery,
  onSearchQueryChange,
  onSearchSelect,
}: TreeToolbarProps) {
  const personName = useMemo(() => {
    const byId = new Map(persons.map((person) => [person.id, person]));
    return (id: string | undefined) => displayName(id === undefined ? undefined : byId.get(id));
  }, [persons]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query === '') {
      return [];
    }
    return persons
      .map((person) => ({ id: person.id, name: displayName(person) }))
      .filter((entry) => entry.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [searchQuery, persons]);

  return (
    <div className="tree-toolbar">
      <div className="tree-direction" role="group">
        {CHART_KINDS.map((entry) => (
          <button
            key={entry.kind}
            type="button"
            className={kind === entry.kind ? 'active' : undefined}
            onClick={() => onKindChange(entry.kind)}
          >
            {nls.t(entry.key)}
          </button>
        ))}
      </div>
      <div className="tree-nav">
        <button
          type="button"
          title={nls.t('tree.canvas.back')}
          aria-label={nls.t('tree.canvas.back')}
          disabled={!canGoBack}
          onClick={onBack}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          title={nls.t('tree.canvas.forward')}
          aria-label={nls.t('tree.canvas.forward')}
          disabled={!canGoForward}
          onClick={onForward}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          title={nls.t('tree.canvas.collapseAll')}
          aria-label={nls.t('tree.canvas.collapseAll')}
          onClick={onCollapseAll}
        >
          <ChevronsDownUp size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          title={nls.t('tree.canvas.expandAll')}
          aria-label={nls.t('tree.canvas.expandAll')}
          onClick={onExpandAll}
        >
          <ChevronsUpDown size={16} aria-hidden="true" />
        </button>
      </div>
      {breadcrumbs.length > 0 && (
        <ol className="tree-breadcrumbs">
          {breadcrumbs.map((personId, index) => (
            <li key={personId}>
              <button
                type="button"
                className={index === breadcrumbs.length - 1 ? 'current' : undefined}
                onClick={() => onJump(index)}
              >
                {personName(personId)}
              </button>
            </li>
          ))}
        </ol>
      )}
      {breadcrumbs.length === 0 && focusPersonId !== undefined && (
        <span className="tree-breadcrumbs-current">{personName(focusPersonId)}</span>
      )}
      <div className="tree-search">
        <Search size={14} aria-hidden="true" />
        <input
          value={searchQuery}
          placeholder={nls.t('tree.canvas.search.placeholder')}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onSearchQueryChange('');
            }
          }}
        />
        {searchResults.length > 0 && (
          <ul className="tree-search-results">
            {searchResults.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => onSearchSelect(entry.id)}>
                  {entry.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

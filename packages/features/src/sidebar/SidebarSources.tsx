import { useMemo } from 'react';
import { BookOpenText } from 'lucide-react';
import type { CitationRecord, SourceRecord } from '@doru/core';
import { nls } from '../nls';
import './sidebar.css';

/**
 * The Sources sidebar: one card per source with its citation count.
 */
export function SidebarSources({
  sources,
  citations,
  onOpenSource,
}: {
  sources: SourceRecord[];
  citations: CitationRecord[];
  onOpenSource: (sourceId: string) => void;
}) {
  const counts = useMemo(() => {
    const bySource = new Map<string, number>();
    for (const citation of citations) {
      bySource.set(citation.sourceId, (bySource.get(citation.sourceId) ?? 0) + 1);
    }
    return bySource;
  }, [citations]);

  return (
    <ul className="side-section-list">
      {sources.map((source) => {
        const details = [source.author, source.publication].filter(
          (part): part is string => part !== undefined && part !== '',
        );
        const count = counts.get(source.id) ?? 0;
        return (
          <li key={source.id} className="entity-card clickable" onClick={() => onOpenSource(source.id)}>
            <span className="entity-card-icon">
              <BookOpenText size={15} aria-hidden="true" />
            </span>
            <span className="entity-card-body">
              <span className="entity-card-title">{source.title}</span>
              {details.length > 0 && <span className="entity-card-subtitle">{details.join(' · ')}</span>}
            </span>
            <span className="entity-card-meta" title={nls.t('features.sidebar.citations', count)}>
              {count > 0 ? count : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

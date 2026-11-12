import { useMemo } from 'react';
import { BookOpenText } from 'lucide-react';
import type { CitationRecord, SourceRecord } from '@doru/core';
import { EntityCard } from '@doru/ui';
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
          <li key={source.id}>
            <EntityCard
              icon={<BookOpenText size={15} aria-hidden="true" />}
              title={source.title}
              subtitle={details.length > 0 ? details.join(' · ') : null}
              meta={count > 0 ? count : null}
              onClick={() => onOpenSource(source.id)}
            />
          </li>
        );
      })}
    </ul>
  );
}

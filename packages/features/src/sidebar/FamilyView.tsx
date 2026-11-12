import { BookOpenText } from 'lucide-react';
import type { CitationRecord, NoteRecord, SourceRecord } from '@doru/core';
import { nls } from '../nls';
import { EntityCard } from '@doru/ui';
import './sidebar.css';

/** The read-only information under the family editor: cited sources and notes. */
export function FamilyInfoList({
  familyId,
  sources,
  citations,
  notes,
}: {
  familyId: string;
  sources: SourceRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
}) {
  const familySources = citations
    .filter((citation) => citation.targetType === 'family' && citation.targetId === familyId)
    .map((citation) => sources.find((source) => source.id === citation.sourceId))
    .filter((source): source is SourceRecord => source !== undefined);
  const familyNotes = notes.filter((note) => note.targetType === 'family' && note.targetId === familyId);

  return (
    <>
      <section className="entity-section">
        <h3>{nls.t('features.tree.sources.title')}</h3>
        {familySources.length === 0 ? (
          <p className="entity-empty">{nls.t('features.tree.sources.empty')}</p>
        ) : (
          <ul className="entity-section-list">
            {familySources.map((source) => (
              <li key={source.id}>
                <EntityCard
                  icon={<BookOpenText size={15} aria-hidden="true" />}
                  title={source.title}
                  subtitle={source.author !== undefined ? source.author : null}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="entity-section">
        <h3>{nls.t('features.tree.notes.title')}</h3>
        {familyNotes.length === 0 ? (
          <p className="entity-empty">{nls.t('features.tree.notes.empty')}</p>
        ) : (
          <ul className="entity-section-list">
            {familyNotes.map((note) => (
              <li key={note.id} className="entity-card">
                <span className="entity-card-body">
                  <span className="entity-note-text">{note.text}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

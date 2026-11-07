import { useMemo } from 'react';
import { BookOpenText, FileText } from 'lucide-react';
import type { CitationRecord, FactRecord, FamilyRecord, NoteRecord, PersonRecord, SourceRecord } from '@doru/core';
import { nls } from '../nls';
import { displayName, familyLabel } from '../person/format';
import './sidebar.css';

/**
 * The source tab: a read-only card of the source — bibliographic details,
 * the records citing it and its notes.
 */
export function SourceView({
  source,
  persons,
  families,
  facts,
  citations,
  notes,
  onOpenPerson,
}: {
  source: SourceRecord;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  onOpenPerson: (personId: string) => void;
}) {
  const personById = useMemo(() => new Map(persons.map((person) => [person.id, person])), [persons]);
  const familyById = useMemo(() => new Map(families.map((family) => [family.id, family])), [families]);

  const citing = citations.filter((citation) => citation.sourceId === source.id);
  const sourceNotes = notes.filter((note) => note.targetType === 'source' && note.targetId === source.id);

  /** The target record a citation points at, with its display label and open action. */
  const citationTarget = (citation: CitationRecord): { label: string; personId?: string | undefined } => {
    if (citation.targetType === 'person') {
      const person = personById.get(citation.targetId);
      return { label: person ? displayName(person) : citation.targetId, personId: citation.targetId };
    }
    if (citation.targetType === 'family') {
      const family = familyById.get(citation.targetId);
      return {
        label: family ? familyLabel(family, personById) : citation.targetId,
        personId: family?.partners[0],
      };
    }
    if (citation.targetType === 'fact') {
      const fact = facts.find((entry) => entry.id === citation.targetId);
      if (fact) {
        if (fact.personId !== undefined) {
          return { label: displayName(personById.get(fact.personId)), personId: fact.personId };
        }
        const family = fact.familyId !== undefined ? familyById.get(fact.familyId) : undefined;
        return { label: family ? familyLabel(family, personById) : citation.targetId, personId: family?.partners[0] };
      }
    }
    if (citation.targetType === 'name') {
      const owner = persons.find((person) => person.names.some((name) => name.id === citation.targetId));
      return { label: owner ? displayName(owner) : citation.targetId, personId: owner?.id };
    }
    return { label: citation.targetId };
  };

  const details = [source.author, source.publication].filter((part): part is string => part !== undefined);

  return (
    <div className="entity-tab">
      <section className="entity-view-card">
        <span className="entity-card-icon entity-view-icon">
          <BookOpenText size={20} aria-hidden="true" />
        </span>
        <div className="entity-view-body">
          <h2 className="entity-view-title">{source.title}</h2>
          {details.length > 0 && <p className="entity-view-subtitle">{details.join(' · ')}</p>}
          {source.abbreviation !== undefined && (
            <p className="entity-view-subtitle">{source.abbreviation}</p>
          )}
        </div>
        <div className="entity-view-badges">
          {citing.length > 0 && (
            <span className="entity-view-badge" title={nls.t('features.sidebar.citations', citing.length)}>
              <FileText size={12} aria-hidden="true" />
              <span>{citing.length}</span>
            </span>
          )}
        </div>
      </section>

      <section className="entity-section">
        <h3>{nls.t('features.sources.citedIn')}</h3>
        {citing.length === 0 ? (
          <p className="entity-empty">{nls.t('features.tree.sources.empty')}</p>
        ) : (
          <ul className="entity-section-list">
            {citing.map((citation) => {
              const target = citationTarget(citation);
              return (
                <li
                  key={citation.id}
                  className={target.personId !== undefined ? 'entity-card clickable' : 'entity-card'}
                  onClick={target.personId !== undefined ? () => onOpenPerson(target.personId ?? '') : undefined}
                >
                  <span className="entity-card-icon">
                    <BookOpenText size={15} aria-hidden="true" />
                  </span>
                  <span className="entity-card-body">
                    <span className="entity-card-title">{target.label}</span>
                    {citation.page !== undefined && (
                      <span className="entity-card-subtitle">{citation.page}</span>
                    )}
                  </span>
                  {citation.quality !== undefined && (
                    <span className="entity-card-meta">{citation.quality}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="entity-section">
        <h3>{nls.t('features.tree.notes.title')}</h3>
        {sourceNotes.length === 0 ? (
          <p className="entity-empty">{nls.t('features.tree.notes.empty')}</p>
        ) : (
          <ul className="entity-section-list">
            {sourceNotes.map((note) => (
              <li key={note.id} className="entity-card">
                <span className="entity-card-body">
                  <span className="entity-note-text">{note.text}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

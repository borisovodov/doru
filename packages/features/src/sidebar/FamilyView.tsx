import { useMemo } from 'react';
import { BookOpenText, Users } from 'lucide-react';
import type { CitationRecord, FactRecord, FamilyRecord, NoteRecord, PersonRecord, SourceRecord } from '@doru/core';
import { nls } from '../nls';
import { displayName, familyLabel, formatDate, initials, lifeSpan } from '../person/format';
import './sidebar.css';

/**
 * The family tab: a read-only card of the family — partners, children,
 * family events, cited sources and notes. Editing happens in the person
 * editor's family section.
 */
export function FamilyView({
  family,
  persons,
  facts,
  sources,
  citations,
  notes,
  onOpenPerson,
}: {
  family: FamilyRecord;
  persons: PersonRecord[];
  facts: FactRecord[];
  sources: SourceRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  onOpenPerson: (personId: string) => void;
}) {
  const personById = useMemo(() => new Map(persons.map((person) => [person.id, person])), [persons]);

  const familyFacts = facts.filter((fact) => fact.familyId === family.id);
  const marriage = familyFacts.find((fact) => fact.tag === 'MARR');
  const familySources = citations
    .filter((citation) => citation.targetType === 'family' && citation.targetId === family.id)
    .map((citation) => sources.find((source) => source.id === citation.sourceId))
    .filter((source): source is SourceRecord => source !== undefined);
  const familyNotes = notes.filter((note) => note.targetType === 'family' && note.targetId === family.id);

  const memberCard = (personId: string) => {
    const person = personById.get(personId);
    return (
      <li key={personId} className="entity-card clickable" onClick={() => onOpenPerson(personId)}>
        <span className={`doru-avatar sex-${person?.sex.toLowerCase() ?? 'u'}`}>
          {person ? initials(person) : '?'}
        </span>
        <span className="entity-card-body">
          <span className="entity-card-title">{displayName(person)}</span>
          {person && lifeSpan(person) !== '' && (
            <span className="entity-card-subtitle">{lifeSpan(person)}</span>
          )}
        </span>
      </li>
    );
  };

  return (
    <div className="entity-tab">
      <section className="entity-view-card">
        <span className="entity-card-icon entity-view-icon">
          <Users size={20} aria-hidden="true" />
        </span>
        <div className="entity-view-body">
          <h2 className="entity-view-title">{familyLabel(family, personById)}</h2>
          <p className="entity-view-subtitle">
            {[
              nls.t('features.sidebar.children', family.children.length),
              marriage?.date ? `⚭ ${formatDate(marriage.date)}` : undefined,
            ]
              .filter((part): part is string => part !== undefined)
              .join(' · ')}
          </p>
        </div>
        <div className="entity-view-badges">
          {familySources.length > 0 && (
            <span className="entity-view-badge" title={nls.t('features.sidebar.citations', familySources.length)}>
              <BookOpenText size={12} aria-hidden="true" />
              <span>{familySources.length}</span>
            </span>
          )}
        </div>
      </section>

      <section className="entity-section">
        <h3>{nls.t('features.tree.families.partners')}</h3>
        {family.partners.length === 0 ? (
          <p className="entity-empty">{nls.t('features.tree.families.empty')}</p>
        ) : (
          <ul className="entity-section-list">{family.partners.map(memberCard)}</ul>
        )}
      </section>

      <section className="entity-section">
        <h3>{nls.t('features.tree.families.children')}</h3>
        {family.children.length === 0 ? (
          <p className="entity-empty">{nls.t('features.tree.families.empty')}</p>
        ) : (
          <ul className="entity-section-list">{family.children.map(memberCard)}</ul>
        )}
      </section>

      <section className="entity-section">
        <h3>{nls.t('features.tree.events.title')}</h3>
        {familyFacts.length === 0 ? (
          <p className="entity-empty">{nls.t('features.tree.events.empty')}</p>
        ) : (
          <ul className="entity-section-list">
            {familyFacts.map((fact) => (
              <li key={fact.id} className="entity-card">
                <span className="tag-chip">{fact.tag}</span>
                <span className="entity-card-body">
                  <span className="entity-card-title">{fact.value ?? fact.type ?? fact.tag}</span>
                  <span className="entity-card-subtitle">
                    {[fact.date ? formatDate(fact.date) : undefined, fact.place]
                      .filter((part): part is string => part !== undefined)
                      .join(' · ')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="entity-section">
        <h3>{nls.t('features.tree.sources.title')}</h3>
        {familySources.length === 0 ? (
          <p className="entity-empty">{nls.t('features.tree.sources.empty')}</p>
        ) : (
          <ul className="entity-section-list">
            {familySources.map((source) => (
              <li key={source.id} className="entity-card">
                <span className="entity-card-icon">
                  <BookOpenText size={15} aria-hidden="true" />
                </span>
                <span className="entity-card-body">
                  <span className="entity-card-title">{source.title}</span>
                  {source.author !== undefined && <span className="entity-card-subtitle">{source.author}</span>}
                </span>
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
    </div>
  );
}

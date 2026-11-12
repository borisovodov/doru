import { useMemo, useState } from 'react';
import { BookOpenText, MapPin, Search, Users } from 'lucide-react';
import type { FactRecord, FamilyRecord, PersonRecord, SourceRecord } from '@doru/core';
import { nls } from '../nls';
import { displayName, familyLabel, formatDate, initials, lifeSpan } from '@doru/ui';
import './sidebar.css';

const MAX_PER_GROUP = 6;

/**
 * The Search sidebar: a free-text query over persons, families, sources,
 * facts and places, grouped by entity kind. Person-family-fact results
 * open their person when clicked.
 */
export function SidebarSearch({
  persons,
  families,
  sources,
  facts,
  onOpenPerson,
  onOpenFamily,
  onOpenSource,
}: {
  persons: PersonRecord[];
  families: FamilyRecord[];
  sources: SourceRecord[];
  facts: FactRecord[];
  onOpenPerson: (personId: string) => void;
  onOpenFamily: (familyId: string) => void;
  onOpenSource: (sourceId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();

  const personById = useMemo(() => new Map(persons.map((person) => [person.id, person])), [persons]);
  const familyById = useMemo(() => new Map(families.map((family) => [family.id, family])), [families]);

  const result = useMemo(() => {
    if (needle === '') {
      return null;
    }
    const matches = (text: string | undefined): boolean =>
      text !== undefined && text.toLowerCase().includes(needle);

    const matchedPersons = persons.filter((person) =>
      person.names.some((name) => matches(name.full) || matches(name.given) || matches(name.surname) || matches(name.nickname)),
    );

    const matchedFamilies = families.filter((family) => {
      if (matches(family.xref)) {
        return true;
      }
      return [...family.partners, ...family.children].some((id) => matchedPersons.some((person) => person.id === id));
    });

    const matchedSources = sources.filter(
      (source) =>
        matches(source.title) || matches(source.author) || matches(source.publication) || matches(source.abbreviation),
    );

    const matchedFacts = facts.filter(
      (fact) => matches(fact.tag) || matches(fact.type) || matches(fact.value) || matches(fact.place),
    );

    const placeCounts = new Map<string, number>();
    for (const fact of facts) {
      if (fact.place && matches(fact.place)) {
        placeCounts.set(fact.place, (placeCounts.get(fact.place) ?? 0) + 1);
      }
    }
    const matchedPlaces = [...placeCounts.entries()].sort((a, b) => b[1] - a[1]);

    return { matchedPersons, matchedFamilies, matchedSources, matchedFacts, matchedPlaces };
  }, [needle, persons, families, sources, facts]);

  const empty =
    result !== null &&
    result.matchedPersons.length === 0 &&
    result.matchedFamilies.length === 0 &&
    result.matchedSources.length === 0 &&
    result.matchedFacts.length === 0 &&
    result.matchedPlaces.length === 0;

  const group = (title: string) => <p className="side-search-group">{title}</p>;

  const ownerOf = (fact: FactRecord): string | undefined => {
    if (fact.personId !== undefined) {
      return fact.personId;
    }
    return families.find((family) => family.id === fact.familyId)?.partners[0];
  };

  return (
    <div className="side-search">
      <div className="side-search-field">
        <Search size={14} aria-hidden="true" />
        <input
          className="side-search-input"
          value={query}
          placeholder={nls.t('features.search.field')}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {result !== null && (
        <ul className="side-section-list">
          {result.matchedPersons.length > 0 && group(nls.t('workbench.activityBar.people'))}
          {result.matchedPersons.slice(0, MAX_PER_GROUP).map((person) => (
              <li key={person.id} className="entity-card clickable" onClick={() => onOpenPerson(person.id)}>
                <span className={`doru-avatar sex-${person.sex.toLowerCase()}`}>{initials(person)}</span>
                <span className="entity-card-body">
                  <span className="entity-card-title">{displayName(person)}</span>
                  {lifeSpan(person) !== '' && <span className="entity-card-subtitle">{lifeSpan(person)}</span>}
                </span>
              </li>
            ))}
          {result.matchedFamilies.length > 0 && group(nls.t('workbench.activityBar.families'))}
          {result.matchedFamilies.slice(0, MAX_PER_GROUP).map((family) => (
            <li key={family.id} className="entity-card clickable" onClick={() => onOpenFamily(family.id)}>
              <span className="entity-card-icon">
                <Users size={15} aria-hidden="true" />
              </span>
              <span className="entity-card-body">
                <span className="entity-card-title">{familyLabel(family, personById)}</span>
                <span className="entity-card-subtitle">
                  {nls.t('features.sidebar.children', family.children.length)}
                </span>
              </span>
            </li>
          ))}
          {result.matchedSources.length > 0 && group(nls.t('workbench.activityBar.sources'))}
          {result.matchedSources.slice(0, MAX_PER_GROUP).map((source) => (
            <li key={source.id} className="entity-card clickable" onClick={() => onOpenSource(source.id)}>
              <span className="entity-card-icon">
                <BookOpenText size={15} aria-hidden="true" />
              </span>
              <span className="entity-card-body">
                <span className="entity-card-title">{source.title}</span>
                {source.author !== undefined && <span className="entity-card-subtitle">{source.author}</span>}
              </span>
            </li>
          ))}
          {result.matchedFacts.length > 0 && group(nls.t('workbench.activityBar.events'))}
          {result.matchedFacts.slice(0, MAX_PER_GROUP).map((fact) => {
            const ownerId = ownerOf(fact);
            return (
              <li
                key={fact.id}
                className={ownerId !== undefined ? 'entity-card clickable' : 'entity-card'}
                onClick={ownerId !== undefined ? () => onOpenPerson(ownerId) : undefined}
              >
                <span className="tag-chip neutral">{fact.tag}</span>
                <span className="entity-card-body">
                  <span className="entity-card-title">{fact.value ?? fact.type ?? factOwner(fact)}</span>
                  <span className="entity-card-subtitle">
                    {[fact.date ? formatDate(fact.date) : undefined, fact.place]
                      .filter((part): part is string => part !== undefined)
                      .join(' · ')}
                  </span>
                </span>
              </li>
            );
          })}
          {result.matchedPlaces.length > 0 && group(nls.t('workbench.activityBar.places'))}
          {result.matchedPlaces.slice(0, MAX_PER_GROUP).map(([place, count]) => (
            <li key={place} className="entity-card">
              <span className="entity-card-icon">
                <MapPin size={15} aria-hidden="true" />
              </span>
              <span className="entity-card-body">
                <span className="entity-card-title">{place}</span>
              </span>
              <span className="entity-card-meta highlight">{count}</span>
            </li>
          ))}
          {empty && <p className="side-search-empty">{nls.t('features.search.empty')}</p>}
        </ul>
      )}
    </div>
  );

  function factOwner(fact: FactRecord): string {
    if (fact.personId !== undefined) {
      return displayName(personById.get(fact.personId));
    }
    const family = fact.familyId !== undefined ? familyById.get(fact.familyId) : undefined;
    return family ? familyLabel(family, personById) : '?';
  }
}

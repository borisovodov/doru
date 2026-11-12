import { useMemo, useState } from 'react';
import { BookOpenText, MapPin, Users } from 'lucide-react';
import type { FactRecord, FamilyRecord, PersonRecord, SourceRecord } from '@doru/core';
import { Avatar, Chip, EntityCard, SearchField } from '@doru/ui';
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
      <SearchField
        label={nls.t('features.search.field')}
        value={query}
        onChange={setQuery}
        className="side-search-field"
      />
      {result !== null && (
        <ul className="side-section-list">
          {result.matchedPersons.length > 0 && group(nls.t('workbench.activityBar.people'))}
          {result.matchedPersons.slice(0, MAX_PER_GROUP).map((person) => (
            <li key={person.id}>
              <EntityCard
                icon={
                  <Avatar
                    initials={initials(person)}
                    tone={person.sex === 'M' ? 'male' : person.sex === 'F' ? 'female' : 'neutral'}
                    size="sm"
                    shape="circle"
                  />
                }
                title={displayName(person)}
                subtitle={lifeSpan(person) !== '' ? lifeSpan(person) : null}
                onClick={() => onOpenPerson(person.id)}
              />
            </li>
          ))}
          {result.matchedFamilies.length > 0 && group(nls.t('workbench.activityBar.families'))}
          {result.matchedFamilies.slice(0, MAX_PER_GROUP).map((family) => (
            <li key={family.id}>
              <EntityCard
                icon={<Users size={15} aria-hidden="true" />}
                title={familyLabel(family, personById)}
                subtitle={nls.t('features.sidebar.children', family.children.length)}
                onClick={() => onOpenFamily(family.id)}
              />
            </li>
          ))}
          {result.matchedSources.length > 0 && group(nls.t('workbench.activityBar.sources'))}
          {result.matchedSources.slice(0, MAX_PER_GROUP).map((source) => (
            <li key={source.id}>
              <EntityCard
                icon={<BookOpenText size={15} aria-hidden="true" />}
                title={source.title}
                subtitle={source.author !== undefined ? source.author : null}
                onClick={() => onOpenSource(source.id)}
              />
            </li>
          ))}
          {result.matchedFacts.length > 0 && group(nls.t('workbench.activityBar.events'))}
          {result.matchedFacts.slice(0, MAX_PER_GROUP).map((fact) => {
            const ownerId = ownerOf(fact);
            return (
              <li key={fact.id}>
                <EntityCard
                  icon={<Chip variant="neutral">{fact.tag}</Chip>}
                  title={fact.value ?? fact.type ?? factOwner(fact)}
                  subtitle={
                    [fact.date ? formatDate(fact.date) : undefined, fact.place]
                      .filter((part): part is string => part !== undefined)
                      .join(' · ')
                  }
                  {...(ownerId !== undefined ? { onClick: () => onOpenPerson(ownerId) } : {})}
                />
              </li>
            );
          })}
          {result.matchedPlaces.length > 0 && group(nls.t('workbench.activityBar.places'))}
          {result.matchedPlaces.slice(0, MAX_PER_GROUP).map(([place, count]) => (
            <li key={place}>
              <EntityCard
                icon={<MapPin size={15} aria-hidden="true" />}
                title={place}
                meta={count}
              />
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

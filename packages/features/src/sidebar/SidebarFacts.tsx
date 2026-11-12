import { useMemo } from 'react';
import type { FactRecord, FamilyRecord, PersonRecord } from '@doru/core';
import { factOwnerName, formatDate } from '@doru/ui';
import './sidebar.css';

/**
 * The Events sidebar: one card per fact (event or attribute) across the
 * whole tree, ordered by date. Clicking opens the fact's owner person.
 */
export function SidebarFacts({
  facts,
  persons,
  families,
  onOpenPerson,
}: {
  facts: FactRecord[];
  persons: PersonRecord[];
  families: FamilyRecord[];
  onOpenPerson: (personId: string) => void;
}) {
  const personById = useMemo(() => new Map(persons.map((person) => [person.id, person])), [persons]);
  const familyById = useMemo(() => new Map(families.map((family) => [family.id, family])), [families]);

  const ownerOf = (fact: FactRecord): string | undefined => {
    if (fact.personId !== undefined) {
      return fact.personId;
    }
    return families.find((family) => family.id === fact.familyId)?.partners[0];
  };

  return (
    <ul className="side-section-list">
      {facts.map((fact) => {
        const ownerId = ownerOf(fact);
        const owner = factOwnerName(fact, personById, familyById);
        const content = fact.value ?? fact.type;
        const details = [
          fact.date ? formatDate(fact.date) : undefined,
          fact.place,
          content === undefined ? owner : undefined,
        ].filter((part): part is string => part !== undefined);
        return (
          <li
            key={fact.id}
            className={ownerId !== undefined ? 'entity-card clickable' : 'entity-card'}
            onClick={ownerId !== undefined ? () => onOpenPerson(ownerId) : undefined}
          >
            <span className={`tag-chip ${content === undefined ? 'neutral' : ''}`}>{fact.tag}</span>
            <span className="entity-card-body">
              <span className="entity-card-title">{content ?? owner}</span>
              {details.length > 0 && <span className="entity-card-subtitle">{details.join(' · ')}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

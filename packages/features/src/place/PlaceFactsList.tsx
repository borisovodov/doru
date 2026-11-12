import { useMemo } from 'react';
import { BookOpenText } from 'lucide-react';
import type { FactRecord, FamilyRecord, PersonRecord } from '@doru/core';
import { nls } from '../nls';
import { factOwnerName, formatDate } from '@doru/ui/domain';
import '../sidebar/sidebar.css';

/** The read-only list of facts that happened at the place. */
export function PlaceFactsList({
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

  const ownerPerson = (fact: FactRecord): string | undefined => {
    if (fact.personId !== undefined) {
      return fact.personId;
    }
    const family = fact.familyId !== undefined ? familyById.get(fact.familyId) : undefined;
    return family?.partners[0];
  };

  return (
    <section className="entity-section">
      <h3>{nls.t('features.tree.place.facts')}</h3>
      {facts.length === 0 ? (
        <p className="entity-empty">{nls.t('features.tree.events.empty')}</p>
      ) : (
        <ul className="entity-section-list">
          {facts.map((fact) => {
            const personId = ownerPerson(fact);
            return (
              <li
                key={fact.id}
                className={personId !== undefined ? 'entity-card clickable' : 'entity-card'}
                onClick={personId !== undefined ? () => onOpenPerson(personId) : undefined}
              >
                <span className="entity-card-icon">
                  <BookOpenText size={15} aria-hidden="true" />
                </span>
                <span className="entity-card-body">
                  <span className="entity-card-title">{factOwnerName(fact, personById, familyById)}</span>
                  <span className="entity-card-subtitle">
                    {fact.type ? `${fact.tag} · ${fact.type}` : fact.tag}
                    {fact.date !== undefined ? ` — ${formatDate(fact.date)}` : ''}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

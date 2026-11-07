import type { PersonRecord } from '@doru/core';
import '../sidebar/sidebar.css';
import { displayName, initials, lifeSpan } from './format';

export interface PersonListProps {
  persons: PersonRecord[];
  onOpen: (personId: string) => void;
}

export function PersonList({ persons, onOpen }: PersonListProps) {
  return (
    <ul className="side-section-list person-list">
      {persons.map((person) => (
        <li key={person.id} className="entity-card clickable" onClick={() => onOpen(person.id)}>
          <span className={`doru-avatar sex-${person.sex.toLowerCase()}`}>{initials(person)}</span>
          <span className="entity-card-body">
            <span className="entity-card-title">{displayName(person)}</span>
            {lifeSpan(person) !== '' && <span className="entity-card-subtitle">{lifeSpan(person)}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

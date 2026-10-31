import type { PersonRecord } from '@doru/core';
import './PersonList.css';
import { displayName, years } from './format';

export interface PersonListProps {
  persons: PersonRecord[];
  onOpen: (personId: string) => void;
}

export function PersonList({ persons, onOpen }: PersonListProps) {
  return (
    <ul className="person-list">
      {persons.map((person) => (
        <li key={person.id} onClick={() => onOpen(person.id)}>
          <span className="person-name">{displayName(person)}</span>
          <span className="person-dates">{years(person)}</span>
        </li>
      ))}
    </ul>
  );
}

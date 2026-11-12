import type { PersonRecord } from '@doru/core';
import { Avatar } from '../../atoms/display/Avatar';
import { EntityCard } from '../../patterns/entity-card/EntityCard';
import { displayName, initials, lifeSpan } from '../format/format';
import styles from './PersonList.module.css';

export interface PersonListProps {
  persons: PersonRecord[];
  onOpen: (personId: string) => void;
}

/** The People sidebar list. Rows are real buttons with the shared card shell. */
export function PersonList({ persons, onOpen }: PersonListProps) {
  return (
    <ul className={styles['list']}>
      {persons.map((person) => (
        <li key={person.id}>
          <EntityCard
            icon={
              <Avatar
                initials={initials(person)}
                tone={person.sex === 'M' ? 'male' : person.sex === 'F' ? 'female' : 'neutral'}
                size="md"
                shape="circle"
              />
            }
            title={displayName(person)}
            subtitle={lifeSpan(person) !== '' ? lifeSpan(person) : null}
            onClick={() => onOpen(person.id)}
          />
        </li>
      ))}
    </ul>
  );
}

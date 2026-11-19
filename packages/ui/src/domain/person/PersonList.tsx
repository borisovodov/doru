import type { PersonRecord } from '@doru/core';
import { Avatar } from '../../atoms/display/Avatar';
import { EntityRow } from '../../patterns/entity-row/EntityRow';
import { SideBarList } from '../../patterns/side-bar-list/SideBarList';
import { displayName, initials, lifeSpan } from '../format/format';

export interface PersonListProps {
  persons: PersonRecord[];
  onOpen: (personId: string) => void;
  /** The person whose tab is active, highlighted as the current row. */
  selectedId?: string | undefined;
}

/** The People sidebar list. Rows are real buttons with the shared card shell. */
export function PersonList({ persons, onOpen, selectedId }: PersonListProps) {
  return (
    <SideBarList>
      {persons.map((person) => (
        <li key={person.id}>
          <EntityRow
            selected={person.id === selectedId}
            iconVariant="plain"
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
    </SideBarList>
  );
}

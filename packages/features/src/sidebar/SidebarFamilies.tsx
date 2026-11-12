import { useMemo } from 'react';
import { Users } from 'lucide-react';
import type { FactRecord, FamilyRecord, PersonRecord } from '@doru/core';
import { nls } from '../nls';
import { familyLabel, formatDate } from '@doru/ui';
import './sidebar.css';

/**
 * The Families sidebar: one card per family, with the partners, the child
 * count and the marriage date. Clicking opens the first partner.
 */
export function SidebarFamilies({
  families,
  persons,
  facts,
  onOpenFamily,
}: {
  families: FamilyRecord[];
  persons: PersonRecord[];
  facts: FactRecord[];
  onOpenFamily: (familyId: string) => void;
}) {
  const personById = useMemo(() => new Map(persons.map((person) => [person.id, person])), [persons]);

  return (
    <ul className="side-section-list">
      {families.map((family) => {
        const marriage = facts.find((fact) => fact.familyId === family.id && fact.tag === 'MARR');
        const details = [
          nls.t('features.sidebar.children', family.children.length),
          marriage?.date ? `⚭ ${formatDate(marriage.date)}` : undefined,
        ].filter((part): part is string => part !== undefined);
        return (
          <li key={family.id} className="entity-card clickable" onClick={() => onOpenFamily(family.id)}>
            <span className="entity-card-icon">
              <Users size={15} aria-hidden="true" />
            </span>
            <span className="entity-card-body">
              <span className="entity-card-title">{familyLabel(family, personById)}</span>
              {details.length > 0 && <span className="entity-card-subtitle">{details.join(' · ')}</span>}
            </span>
            {family.children.length > 0 && (
              <span className="entity-card-meta highlight">{family.children.length}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

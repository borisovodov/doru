import { useMemo } from 'react';
import { Users } from 'lucide-react';
import type { FactRecord, FamilyRecord, PersonRecord } from '@doru/core';
import { nls } from '../nls';
import { familyLabel, formatDate } from '@doru/ui/domain';
import { EntityRow, SideBarList } from '@doru/ui';
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
  selectedId,
}: {
  families: FamilyRecord[];
  persons: PersonRecord[];
  facts: FactRecord[];
  onOpenFamily: (familyId: string) => void;
  selectedId?: string | undefined;
}) {
  const personById = useMemo(() => new Map(persons.map((person) => [person.id, person])), [persons]);

  return (
    <SideBarList>
      {families.map((family) => {
        const marriage = facts.find((fact) => fact.familyId === family.id && fact.tag === 'MARR');
        const details = [
          nls.t('features.sidebar.children', family.children.length),
          marriage?.date ? `⚭ ${formatDate(marriage.date)}` : undefined,
        ].filter((part): part is string => part !== undefined);
        return (
          <li key={family.id}>
            <EntityRow
              selected={family.id === selectedId}
              icon={<Users size={15} aria-hidden="true" />}
              title={familyLabel(family, personById)}
              subtitle={details.length > 0 ? details.join(' · ') : null}
              meta={family.children.length > 0 ? family.children.length : null}
              onClick={() => onOpenFamily(family.id)}
            />
          </li>
        );
      })}
    </SideBarList>
  );
}

import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import type { PersonRecord } from '@doru/core';
import { displayName, years } from '../person/format';

export type PersonCardData = {
  person: PersonRecord;
};

/**
 * Minimal M0 card: name + years. Size is fixed in CSS and mirrored by the
 * layout options so the tidy-tree math matches the rendered pixels.
 */
export const PersonCard = memo(function PersonCard({
  data,
  selected,
}: NodeProps<Node<PersonCardData>>) {
  const dates = years(data.person);
  return (
    <div className={selected ? 'person-card selected' : 'person-card'}>
      <span className="person-card-name">{displayName(data.person)}</span>
      {dates !== '' && <span className="person-card-years">{dates}</span>}
    </div>
  );
});

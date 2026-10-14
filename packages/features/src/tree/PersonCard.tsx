import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { PersonRecord } from '@doru/core';
import { displayName, years } from '../person/format';

export type PersonCardData = {
  person: PersonRecord;
};

/**
 * Person card. Size is fixed in CSS and mirrored by the layout options so
 * the tidy-tree math matches the rendered pixels. The handles are invisible:
 * React Flow requires them to attach edges, but the pedigree edges draw
 * their own geometry from layout data.
 */
export const PersonCard = memo(function PersonCard({
  data,
  selected,
}: NodeProps<Node<PersonCardData>>) {
  const dates = years(data.person);
  return (
    <div className={selected ? 'person-card selected' : 'person-card'}>
      <Handle type="target" position={Position.Top} className="person-card-handle" />
      <Handle type="source" position={Position.Bottom} className="person-card-handle" />
      <span className="person-card-name">{displayName(data.person)}</span>
      {dates !== '' && <span className="person-card-years">{dates}</span>}
    </div>
  );
});

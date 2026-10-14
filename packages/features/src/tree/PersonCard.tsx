import { memo, type MouseEvent } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { PedigreeLine, PersonRecord } from '@doru/core';
import { nls } from '../nls';
import { displayName, years } from '../person/format';

export type PersonCardData = {
  person: PersonRecord;
  /** Father's side / mother's side in ancestor charts. */
  line: PedigreeLine;
  /** The focus card gets an accent frame. */
  isFocus: boolean;
  /** Whether this card has a collapsible subtree. */
  hasSubtree: boolean;
  /** Whether the subtree is currently collapsed. */
  collapsed: boolean;
  onToggleCollapse?: (personId: string) => void;
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
  const { person, line, isFocus, hasSubtree, collapsed } = data;
  const deceased = person.death?.year !== undefined;
  const dates = years(person);
  const classes = [
    'person-card',
    person.sex === 'M' ? 'sex-m' : person.sex === 'F' ? 'sex-f' : 'sex-u',
    line === 'paternal' ? 'line-paternal' : line === 'maternal' ? 'line-maternal' : '',
    selected ? 'selected' : '',
    isFocus ? 'focus' : '',
    deceased ? 'deceased' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleCollapseClick = (event: MouseEvent) => {
    event.stopPropagation();
    data.onToggleCollapse?.(person.id);
  };

  return (
    <div className={classes}>
      <Handle type="target" position={Position.Top} className="person-card-handle" />
      <Handle type="source" position={Position.Bottom} className="person-card-handle" />
      <span className="sex-dot" aria-hidden="true" />
      <span className="person-card-name">{displayName(person)}</span>
      {dates !== '' && (
        <span className="person-card-years">
          {deceased ? '† ' : ''}
          {dates}
        </span>
      )}
      {hasSubtree && (
        <button
          type="button"
          className="person-card-collapse"
          title={collapsed ? nls.t('tree.canvas.expand') : nls.t('tree.canvas.collapse')}
          aria-label={collapsed ? nls.t('tree.canvas.expand') : nls.t('tree.canvas.collapse')}
          onClick={handleCollapseClick}
        >
          {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
});

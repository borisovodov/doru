import { memo, type MouseEvent } from 'react';
import {
  Baby,
  BookOpenText,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Pencil,
  PencilLine,
  StickyNote,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Handle,
  NodeToolbar,
  Position,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import type { PedigreeLine, PersonRecord } from '@doru/core';
import { nls } from '../nls';
import { displayName, years } from '../person/format';
import type { PersonCounts } from './types';

export type CardAction = 'child' | 'spouse' | 'parent' | 'edit' | 'rename' | 'delete';

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
  /** Badge counts (notes, sources, media). */
  counts: PersonCounts;
  /** Highlighted as the drop target of an ongoing card drag. */
  isDropTarget: boolean;
  onToggleCollapse?: (personId: string) => void;
  /** Quick actions on the selected card (add/edit/delete relatives). */
  onAction?: (action: CardAction, personId: string) => void;
};

function initials(person: PersonRecord): string {
  const name = person.names[0];
  if (!name) {
    return '?';
  }
  if (name.full) {
    const words = name.full.replace(/\//g, '').trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('');
  }
  const parts = [name.given, name.surname].filter((part) => part !== undefined) as string[];
  if (parts.length === 0) {
    return '?';
  }
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

/**
 * Person card. Size is fixed in CSS and mirrored by the layout options so
 * the tidy-tree math matches the rendered pixels. The handles are invisible:
 * React Flow requires them to attach edges, but the pedigree edges draw
 * their own geometry from layout data.
 */
export const PersonCard = memo(function PersonCard({
  data,
  selected,
  dragging,
}: NodeProps<Node<PersonCardData>>) {
  const { person, line, isFocus, hasSubtree, collapsed, counts, isDropTarget, onAction } = data;
  const deceased = person.death?.year !== undefined;
  const dates = years(person);
  const classes = [
    'person-card',
    person.sex === 'M' ? 'sex-m' : person.sex === 'F' ? 'sex-f' : 'sex-u',
    line === 'paternal' ? 'line-paternal' : line === 'maternal' ? 'line-maternal' : '',
    selected ? 'selected' : '',
    isFocus ? 'focus' : '',
    deceased ? 'deceased' : '',
    dragging ? 'dragging' : '',
    isDropTarget ? 'drop-target' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleCollapseClick = (event: MouseEvent) => {
    event.stopPropagation();
    data.onToggleCollapse?.(person.id);
  };

  const action = (kind: CardAction) => (event: MouseEvent) => {
    event.stopPropagation();
    onAction?.(kind, person.id);
  };

  const ACTIONS = [
    { kind: 'child', icon: Baby, key: 'tree.canvas.addChild' },
    { kind: 'spouse', icon: UserPlus, key: 'tree.canvas.addSpouse' },
    { kind: 'parent', icon: Users, key: 'tree.canvas.addParent' },
    { kind: 'rename', icon: PencilLine, key: 'tree.canvas.rename' },
    { kind: 'edit', icon: Pencil, key: 'tree.canvas.edit' },
    { kind: 'delete', icon: Trash2, key: 'tree.canvas.deletePerson' },
  ] as const satisfies ReadonlyArray<{ kind: CardAction; icon: typeof Baby; key: string }>;

  const BADGES = [
    { icon: StickyNote, count: counts.notes, title: nls.t('features.tree.notes.title') },
    { icon: BookOpenText, count: counts.sources, title: nls.t('features.tree.sources.title') },
    { icon: ImageIcon, count: counts.media, title: nls.t('features.tree.media.title') },
  ] as const;

  return (
    <div className={classes}>
      <Handle type="target" position={Position.Top} className="person-card-handle" />
      <Handle type="source" position={Position.Bottom} className="person-card-handle" />
      <span className="person-card-avatar" aria-hidden="true">
        {initials(person)}
      </span>
      <div className="person-card-body">
        <span className="person-card-name">{displayName(person)}</span>
        {dates !== '' && (
          <span className="person-card-years">
            {deceased ? '† ' : ''}
            {dates}
          </span>
        )}
      </div>
      <div className="person-card-badges">
        {BADGES.map(({ icon: Icon, count, title }) =>
          count > 0 ? (
            <span key={title} className="person-card-badge" title={`${title}: ${count}`}>
              <Icon size={11} aria-hidden="true" />
              <span>{count}</span>
            </span>
          ) : null,
        )}
      </div>
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
      {onAction && selected && (
        <NodeToolbar position={Position.Top} className="card-toolbar" offset={8}>
          {ACTIONS.map(({ kind, icon: Icon, key }) => (
            <button key={kind} type="button" title={nls.t(key)} aria-label={nls.t(key)} onClick={action(kind)}>
              <Icon size={14} aria-hidden="true" />
            </button>
          ))}
        </NodeToolbar>
      )}
    </div>
  );
});

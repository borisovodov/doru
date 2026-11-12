import { memo, type MouseEvent } from 'react';
import { Baby, Pencil, Trash2, UserPlus, Users } from 'lucide-react';
import { Handle, NodeToolbar, Position, type Node, type NodeProps } from '@xyflow/react';
import type { PedigreeLine, PersonRecord } from '@doru/core';
import { IconButton } from '@doru/ui';
import { PersonCardEditor, PersonCardView, type CardAction, type PersonCounts } from '@doru/ui/domain';
import { nls } from '../nls';

export type { CardAction } from '@doru/ui/domain';

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
  /** A never-persisted draft card (new person typed on the canvas). */
  isDraft?: boolean;
  /** The draft card is showing its name inputs (as opposed to the idle
   *  "Add the first person" placeholder). */
  isEditing?: boolean;
  /** Creates the person with the typed name. */
  onDraftSave?: (person: PersonRecord) => void;
  /** Abandons the draft card. */
  onDraftCancel?: () => void;
  onToggleCollapse?: (personId: string) => void;
  /** Quick actions on the selected card (add/edit/delete relatives). */
  onAction?: (action: CardAction, personId: string) => void;
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
  dragging,
}: NodeProps<Node<PersonCardData>>) {
  const {
    person,
    line,
    isFocus,
    hasSubtree,
    collapsed,
    counts,
    isDropTarget,
    isDraft,
    isEditing,
    onDraftSave,
    onDraftCancel,
    onAction,
  } = data;

  const action = (kind: CardAction) => (event: MouseEvent) => {
    event.stopPropagation();
    onAction?.(kind, person.id);
  };

  const ACTIONS = [
    { kind: 'child', icon: Baby, key: 'tree.canvas.addChild' },
    { kind: 'spouse', icon: UserPlus, key: 'tree.canvas.addSpouse' },
    { kind: 'parent', icon: Users, key: 'tree.canvas.addParent' },
    { kind: 'edit', icon: Pencil, key: 'tree.canvas.edit' },
    { kind: 'delete', icon: Trash2, key: 'tree.canvas.deletePerson' },
  ] as const satisfies ReadonlyArray<{ kind: CardAction; icon: typeof Baby; key: string }>;

  if (isEditing) {
    return (
      <PersonCardView
        person={person}
        line={line}
        isFocus={isFocus}
        hasSubtree={false}
        collapsed={false}
        counts={counts}
        isDropTarget={false}
        isEditing
        editingContent={
          <PersonCardEditor
            autoFocus
            onSave={(next) => onDraftSave?.(next)}
            onCancel={() => onDraftCancel?.()}
          />
        }
      >
        <Handle type="target" position={Position.Top} className="person-card-handle" />
        <Handle type="source" position={Position.Bottom} className="person-card-handle" />
      </PersonCardView>
    );
  }

  return (
    <PersonCardView
      person={person}
      line={line}
      isFocus={isFocus}
      hasSubtree={hasSubtree}
      collapsed={collapsed}
      counts={counts}
      isDropTarget={isDropTarget}
      selected={selected}
      dragging={dragging}
      isDraft={isDraft}
      onToggleCollapse={data.onToggleCollapse}
      toolbar={
        onAction && selected ? (
          <NodeToolbar position={Position.Top} className="card-toolbar" offset={8}>
            {ACTIONS.map(({ kind, icon: Icon, key }) => (
              <IconButton
                key={kind}
                size="sm"
                variant={kind === 'delete' ? 'danger' : 'ghost'}
                label={nls.t(key)}
                icon={<Icon size={14} aria-hidden="true" />}
                onClick={action(kind)}
              />
            ))}
          </NodeToolbar>
        ) : null
      }
    >
      <Handle type="target" position={Position.Top} className="person-card-handle" />
      <Handle type="source" position={Position.Bottom} className="person-card-handle" />
    </PersonCardView>
  );
});

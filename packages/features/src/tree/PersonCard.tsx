import { memo, useState, type FormEvent, type MouseEvent } from 'react';
import {
  Baby,
  Check,
  Pencil,
  Trash2,
  UserPlus,
  Users,
  X,
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
import { IconButton, PersonCardView, type CardAction, type PersonCounts } from '@doru/ui';

export type { CardAction } from '@doru/ui';

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
  const [given, setGiven] = useState('');
  const [surname, setSurname] = useState('');
  const classes = [
    'person-card',
    person.sex === 'M' ? 'sex-m' : person.sex === 'F' ? 'sex-f' : 'sex-u',
    line === 'paternal' ? 'line-paternal' : line === 'maternal' ? 'line-maternal' : '',
    selected ? 'selected' : '',
    isFocus ? 'focus' : '',
    dragging ? 'dragging' : '',
    isDropTarget ? 'drop-target' : '',
    isDraft ? 'draft' : '',
    isEditing ? 'editing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const action = (kind: CardAction) => (event: MouseEvent) => {
    event.stopPropagation();
    onAction?.(kind, person.id);
  };

  const saveDraft = (event: FormEvent) => {
    event.preventDefault();
    const trimmedGiven = given.trim();
    const trimmedSurname = surname.trim();
    if (!trimmedGiven && !trimmedSurname) {
      return;
    }
    onDraftSave?.({
      id: crypto.randomUUID(),
      names: [
        {
          id: crypto.randomUUID(),
          ...(trimmedGiven !== '' ? { given: trimmedGiven } : {}),
          ...(trimmedSurname !== '' ? { surname: trimmedSurname } : {}),
        },
      ],
      sex: 'U',
      facts: [],
    });
  };

  const ACTIONS = [
    { kind: 'child', icon: Baby, key: 'tree.canvas.addChild' },
    { kind: 'spouse', icon: UserPlus, key: 'tree.canvas.addSpouse' },
    { kind: 'parent', icon: Users, key: 'tree.canvas.addParent' },
    { kind: 'edit', icon: Pencil, key: 'tree.canvas.edit' },
    { kind: 'delete', icon: Trash2, key: 'tree.canvas.deletePerson' },
  ] as const satisfies ReadonlyArray<{ kind: CardAction; icon: typeof Baby; key: string }>;

  if (isEditing) {
    // The draft card turned editor: only the name is typed here; everything
    // else lives in the person tab after the person exists.
    return (
      <div
        className={classes}
        role="group"
        aria-label={nls.t('tree.canvas.addFirstPerson')}
        aria-current={isFocus ? 'true' : undefined}
      >
        <Handle type="target" position={Position.Top} className="person-card-handle" />
        <Handle type="source" position={Position.Bottom} className="person-card-handle" />
        <form className="person-card-edit" onSubmit={saveDraft} aria-label={nls.t('tree.canvas.addFirstPerson')}>
          <div className="person-card-edit-fields">
            <input
              value={given}
              placeholder={nls.t('features.tree.field.given')}
              aria-label={nls.t('features.tree.field.given')}
              onChange={(event) => setGiven(event.target.value)}
              autoFocus
            />
            <input
              value={surname}
              placeholder={nls.t('features.tree.field.surname')}
              aria-label={nls.t('features.tree.field.surname')}
              onChange={(event) => setSurname(event.target.value)}
            />
          </div>
          <div className="person-card-edit-actions">
            <button
              type="submit"
              title={nls.t('features.tree.save')}
              aria-label={nls.t('features.tree.save')}
              disabled={!given.trim() && !surname.trim()}
            >
              <Check size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              title={nls.t('tree.canvas.cancel')}
              aria-label={nls.t('tree.canvas.cancel')}
              onClick={() => onDraftCancel?.()}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>
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

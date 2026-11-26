import { Baby, Pencil, Trash2, UserPlus, Users } from 'lucide-react';
import { IconButton } from '@doru/ui';
import type { CardAction } from '@doru/ui/domain';
import { nls } from '../nls';

const ACTIONS = [
  { kind: 'child', icon: Baby, key: 'tree.canvas.addChild' },
  { kind: 'spouse', icon: UserPlus, key: 'tree.canvas.addSpouse' },
  { kind: 'parent', icon: Users, key: 'tree.canvas.addParent' },
  { kind: 'edit', icon: Pencil, key: 'tree.canvas.edit' },
  { kind: 'delete', icon: Trash2, key: 'tree.canvas.deletePerson' },
] as const satisfies ReadonlyArray<{ kind: CardAction; icon: typeof Baby; key: string }>;

export function CardToolbar({
  personId,
  onAction,
}: {
  personId: string;
  onAction(action: CardAction, personId: string): void;
}) {
  return (
    <div className="card-toolbar">
      {ACTIONS.map(({ kind, icon: Icon, key }) => (
        <IconButton
          key={kind}
          size="sm"
          variant={kind === 'delete' ? 'danger' : 'ghost'}
          label={nls.t(key)}
          icon={<Icon size={14} aria-hidden="true" />}
          onClick={(event) => {
            event.stopPropagation();
            onAction(kind, personId);
          }}
        />
      ))}
    </div>
  );
}

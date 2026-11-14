import { ChevronDown, ChevronUp } from 'lucide-react';
import { IconButton } from '../icon-button/IconButton';

export interface ReorderButtonsProps {
  upLabel: string;
  downLabel: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

/** Small up/down controls for lists whose order is persisted by position. */
export function ReorderButtons({
  upLabel,
  downLabel,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: ReorderButtonsProps) {
  return (
    <>
      <IconButton
        size="sm"
        label={upLabel}
        disabled={!canMoveUp}
        icon={<ChevronUp size={13} aria-hidden="true" />}
        onClick={onMoveUp}
      />
      <IconButton
        size="sm"
        label={downLabel}
        disabled={!canMoveDown}
        icon={<ChevronDown size={13} aria-hidden="true" />}
        onClick={onMoveDown}
      />
    </>
  );
}

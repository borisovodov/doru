import { memo, type KeyboardEvent } from 'react';
import { GripVertical } from 'lucide-react';
import type { LaidOutCard, PersonRecord } from '@doru/core';
import { CanvasItem, usePointerDrag } from '@doru/canvas';
import { PersonCardView, type PersonCounts } from '@doru/ui/domain';
import { CARD_HEIGHT, CARD_WIDTH } from './sizes';

export interface PersonCardProps {
  card: LaidOutCard;
  person: PersonRecord;
  counts: PersonCounts;
  photo?: string | undefined;
  isFocus: boolean;
  selected: boolean;
  isDropTarget: boolean;
  collapsed: boolean;
  onSelect(cardKey: string): void;
  onClearSelection(): void;
  onActivate(cardKey: string): void;
  onToggleCollapse(personId: string): void;
  onDragStart(cardKey: string): void;
  onDragMove(cardKey: string, dx: number, dy: number): void;
  onDragEnd(cardKey: string, dx: number, dy: number, cancelled: boolean): void;
}

/**
 * A positioned person card. Layout fixes its world position; dragging only
 * carries a temporary offset and is interpreted by the canvas as a reparent
 * gesture, never as a new permanent position.
 */
export const PersonCard = memo(function PersonCard({
  card,
  person,
  counts,
  photo,
  isFocus,
  selected,
  isDropTarget,
  collapsed,
  onSelect,
  onClearSelection,
  onActivate,
  onToggleCollapse,
  onDragStart,
  onDragMove,
  onDragEnd,
}: PersonCardProps) {
  const drag = usePointerDrag({
    onStart: () => onDragStart(card.key),
    onMove: (dx, dy) => onDragMove(card.key, dx, dy),
    onEnd: (dx, dy, cancelled) => onDragEnd(card.key, dx, dy, cancelled),
  });

  const handleClick = (): void => {
    if (drag.consumeClickSuppression()) {
      return;
    }
    onSelect(card.key);
  };

  const handleDoubleClick = (): void => {
    if (drag.consumeClickSuppression()) {
      return;
    }
    onActivate(card.key);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(card.key);
    } else if (event.key === 'Escape') {
      onClearSelection();
    }
  };

  return (
    <CanvasItem
      x={card.x - CARD_WIDTH / 2}
      y={card.y - CARD_HEIGHT / 2}
      width={CARD_WIDTH}
      height={CARD_HEIGHT}
      className="tree-card"
      style={drag.dragging ? { transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 10 } : undefined}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <PersonCardView
        person={person}
        line={card.line}
        isFocus={isFocus}
        hasSubtree={card.hasSubtree}
        collapsed={collapsed}
        counts={counts}
        isDropTarget={isDropTarget}
        {...(photo === undefined ? {} : { photo })}
        selected={selected}
        dragging={drag.dragging}
        onToggleCollapse={onToggleCollapse}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        dragHandle={
          <div className="tree-card-drag-handle" data-canvas-no-pan aria-hidden="true" {...drag.handlers}>
            <GripVertical size={12} aria-hidden="true" />
          </div>
        }
      />
    </CanvasItem>
  );
});

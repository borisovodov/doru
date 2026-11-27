import { memo, type KeyboardEvent } from 'react';
import type { LaidOutCard, PersonRecord } from '@doru/core';
import { CanvasItem } from '@doru/canvas';
import { PersonCardView, type PersonCounts } from '@doru/ui/domain';
import { CARD_HEIGHT, CARD_WIDTH } from './sizes';

export interface PersonCardProps {
  card: LaidOutCard;
  person: PersonRecord;
  counts: PersonCounts;
  photo?: string | undefined;
  isFocus: boolean;
  selected: boolean;
  onSelect(cardKey: string): void;
  onClearSelection(): void;
  onActivate(cardKey: string): void;
}

/**
 * A positioned person card. Layout fixes its world position; the canvas owns
 * panning and cards themselves are not draggable.
 */
export const PersonCard = memo(function PersonCard({
  card,
  person,
  counts,
  photo,
  isFocus,
  selected,
  onSelect,
  onClearSelection,
  onActivate,
}: PersonCardProps) {
  const handleClick = (): void => {
    onSelect(card.key);
  };

  const handleDoubleClick = (): void => {
    onActivate(card.key);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // Only the focused card itself selects on Enter/Space; descendants keep
    // their native keyboard activation.
    if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
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
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <PersonCardView
        person={person}
        line={card.line}
        isFocus={isFocus}
        counts={counts}
        {...(photo === undefined ? {} : { photo })}
        selected={selected}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      />
    </CanvasItem>
  );
});

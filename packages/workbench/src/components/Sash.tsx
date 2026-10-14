import { useRef, type PointerEvent } from 'react';

export interface SashProps {
  className?: string;
  /** Fires once when a resize gesture starts, so the owner can capture the current size. */
  onDragStart: () => void;
  /** Fires on every move with the horizontal delta since the gesture start (positive = right). */
  onResize: (deltaX: number) => void;
}

/**
 * A vertical resize handle between two panels. Pointer-based (no native drag
 * session), so the cursor and the gesture are fully controlled, like the tab
 * reordering in the tab bar.
 */
export function Sash({ className, onDragStart, onResize }: SashProps) {
  const startXRef = useRef<number | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    onDragStart();
    startXRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add('dragging');
    document.body.classList.add('sash-resizing');
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (startXRef.current === null) {
      return;
    }
    onResize(event.clientX - startXRef.current);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (startXRef.current === null) {
      return;
    }
    startXRef.current = null;
    event.currentTarget.classList.remove('dragging');
    document.body.classList.remove('sash-resizing');
  };

  return (
    <div
      className={className ? `sash ${className}` : 'sash'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  );
}

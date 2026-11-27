import type { ReactNode } from 'react';
import type { OverlayPosition, Rect } from './types';
import { useCanvasViewport } from './useCanvas';
import styles from './canvas.module.css';

export interface CanvasOverlayProps {
  /** World-space rectangle the overlay is anchored to. */
  anchor: Rect;
  position?: OverlayPosition | undefined;
  /** Gap between the anchor and the overlay in screen pixels. */
  offset?: number | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/**
 * A screen-space element pinned to a world rectangle (a selected card's
 * toolbar, for example). It stays the same size at every zoom level.
 */
export function CanvasOverlay({ anchor, position = 'top', offset = 8, className, children }: CanvasOverlayProps) {
  const viewport = useCanvasViewport();
  const centerX = anchor.x + anchor.width / 2;
  const left = viewport.x + centerX * viewport.zoom;
  const top =
    position === 'top'
      ? viewport.y + anchor.y * viewport.zoom - offset
      : viewport.y + (anchor.y + anchor.height) * viewport.zoom + offset;
  return (
    <div
      className={[styles['overlay'], className].filter(Boolean).join(' ')}
      style={{
        left,
        top,
        transform: position === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
      }}
      data-canvas-overlay
      data-canvas-no-pan
      data-canvas-no-wheel
    >
      {children}
    </div>
  );
}

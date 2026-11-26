import type { ReactNode } from 'react';
import type { PanelPosition } from './types';
import styles from './canvas.module.css';

export interface CanvasPanelProps {
  position: PanelPosition;
  className?: string | undefined;
  children: ReactNode;
}

const POSITION_CLASS = {
  'top-left': 'topLeft',
  'top-right': 'topRight',
  'bottom-left': 'bottomLeft',
  'bottom-right': 'bottomRight',
} as const satisfies Record<PanelPosition, keyof typeof styles>;

/** A screen-space overlay panel that does not move with the viewport. */
export function CanvasPanel({ position, className, children }: CanvasPanelProps) {
  return (
    <div
      className={[styles['panel'], styles[POSITION_CLASS[position]], className].filter(Boolean).join(' ')}
      data-canvas-panel
      data-canvas-no-pan
      data-canvas-no-wheel
    >
      {children}
    </div>
  );
}

import type { ComponentPropsWithoutRef, CSSProperties } from 'react';
import styles from './canvas.module.css';

export interface CanvasItemProps extends Omit<ComponentPropsWithoutRef<'div'>, 'style'> {
  /** Left edge in world coordinates. */
  x: number;
  /** Top edge in world coordinates. */
  y: number;
  width: number;
  height: number;
  style?: CSSProperties | undefined;
}

/** An absolutely positioned item inside the transformed world layer. */
export function CanvasItem({ x, y, width, height, className, style, children, ...rest }: CanvasItemProps) {
  return (
    <div
      {...rest}
      className={[styles['item'], className].filter(Boolean).join(' ')}
      style={{ left: x, top: y, width, height, ...style }}
      data-canvas-item
    >
      {children}
    </div>
  );
}

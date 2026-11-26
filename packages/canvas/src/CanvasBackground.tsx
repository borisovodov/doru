import { useCanvasViewport } from './useCanvas';
import styles from './canvas.module.css';

export interface CanvasBackgroundProps {
  gap?: number | undefined;
  /** Dot diameter in world units. */
  size?: number | undefined;
  color?: string | undefined;
  className?: string | undefined;
}

/** A dots pattern that pans and zooms with the viewport. */
export function CanvasBackground({ gap = 20, size = 1, color = '#b1b1b7', className }: CanvasBackgroundProps) {
  const viewport = useCanvasViewport();
  const zoom = Math.max(0.1, viewport.zoom);
  const gapPx = gap * zoom;
  const radiusPx = Math.max(0.5, (size * zoom) / 2);
  return (
    <div
      aria-hidden="true"
      className={[styles['background'], className].filter(Boolean).join(' ')}
      data-canvas-background
      style={{
        backgroundImage: `radial-gradient(circle, ${color} ${radiusPx}px, transparent ${radiusPx}px)`,
        backgroundSize: `${gapPx}px ${gapPx}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
    />
  );
}

import { clamp } from './geometry';
import { useCanvasViewport } from './useCanvas';
import styles from './canvas.module.css';

export interface CanvasBackgroundProps {
  gap?: number | undefined;
  /** Dot diameter in world units. */
  size?: number | undefined;
  color?: string | undefined;
  /**
   * Minimum on-screen gap in CSS pixels. Keeps the pattern readable when the
   * viewport is zoomed far out and the browser would otherwise rasterize the
   * tiny tiles as a solid tint.
   */
  minGap?: number | undefined;
  /** Minimum dot diameter in CSS pixels. */
  minSize?: number | undefined;
  /**
   * On-screen gap at which the pattern is fully opaque. Below it the pattern
   * fades toward `minOpacity` as the gap approaches `minGap`, so a dense grid
   * never turns into visual noise. Omit to keep a constant opacity.
   */
  fadeGap?: number | undefined;
  /** Opacity floor for the fade. Defaults to 0 (fully transparent). */
  minOpacity?: number | undefined;
  className?: string | undefined;
}

/** A dots pattern that pans and zooms with the viewport. */
export function CanvasBackground({
  gap = 20,
  size = 1,
  color = '#b1b1b7',
  minGap = 0,
  minSize = 1,
  fadeGap,
  minOpacity = 0,
  className,
}: CanvasBackgroundProps) {
  const viewport = useCanvasViewport();
  const zoom = Math.max(0.1, viewport.zoom);
  const gapPx = Math.max(gap * zoom, minGap);
  const radiusPx = Math.max(minSize / 2, (size * zoom) / 2);
  const opacityFloor = clamp(minOpacity, 0, 1);
  const opacity =
    fadeGap === undefined || fadeGap <= minGap
      ? 1
      : opacityFloor + (1 - opacityFloor) * clamp((gapPx - minGap) / (fadeGap - minGap), 0, 1);
  return (
    <div
      aria-hidden="true"
      className={[styles['background'], className].filter(Boolean).join(' ')}
      data-canvas-background
      style={{
        backgroundImage: `radial-gradient(circle, ${color} ${radiusPx}px, transparent ${radiusPx}px)`,
        backgroundSize: `${gapPx}px ${gapPx}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        opacity,
      }}
    />
  );
}

import { clamp } from './geometry';

export interface DotPatternOptions {
  gap: number;
  size: number;
  minGap: number;
  minSize: number;
  fadeGap?: number | undefined;
  minOpacity: number;
}

export interface DotPattern {
  gapPx: number;
  radiusPx: number;
  opacity: number;
}

/**
 * Screen-space metrics for the canvas dot pattern. The pattern never shrinks
 * below the configured on-screen gap and dot size, and it fades toward
 * `minOpacity` when the gap approaches `minGap`.
 */
export function dotPattern(zoom: number, options: DotPatternOptions): DotPattern {
  const { gap, size, minGap, minSize, fadeGap, minOpacity } = options;
  // Keep the background from shrinking below the canvas zoom floor; this also
  // avoids sub-pixel tiles if a caller allows a lower viewport zoom.
  const scale = Math.max(0.1, zoom);
  const gapPx = Math.max(gap * scale, minGap);
  const radiusPx = Math.max(minSize / 2, (size * scale) / 2);
  const opacityFloor = clamp(minOpacity, 0, 1);
  // An empty fade range has nothing to interpolate across; keep the pattern
  // fully opaque instead of dividing by zero.
  const opacity =
    fadeGap === undefined || fadeGap <= minGap
      ? 1
      : opacityFloor + (1 - opacityFloor) * clamp((gapPx - minGap) / (fadeGap - minGap), 0, 1);
  return { gapPx, radiusPx, opacity };
}

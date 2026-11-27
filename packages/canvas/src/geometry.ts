import type { FitOptions, Point, Rect, Viewport } from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Converts a point in screen (canvas-relative) coordinates to world coordinates. */
export function screenToWorld(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  };
}

/** Converts a point in world coordinates to screen (canvas-relative) coordinates. */
export function worldToScreen(point: Point, viewport: Viewport): Point {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  };
}

/**
 * Computes the viewport that fits `bounds` into a `width` x `height` canvas:
 * the whole bounds centered, with a padding fraction, never beyond maxZoom.
 */
export function fitViewport(bounds: Rect, width: number, height: number, options: FitOptions = {}): Viewport {
  const padding = options.padding ?? 0.1;
  const minZoom = options.minZoom ?? 0.1;
  const maxZoom = options.maxZoom ?? 2;
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const fit = Math.min(safeWidth / bounds.width, safeHeight / bounds.height);
  const zoom = clamp(fit * (1 - padding), minZoom, maxZoom);
  return {
    x: (safeWidth - bounds.width * zoom) / 2 - bounds.x * zoom,
    y: (safeHeight - bounds.height * zoom) / 2 - bounds.y * zoom,
    zoom,
  };
}

export function isMacOs(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');
}

interface WheelLike {
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
}

/**
 * Normalizes a wheel delta the way `d3-zoom` expects it. Trackpad pinch on
 * macOS arrives as ctrl+wheel with small deltas and is amplified to feel like
 * the native pinch gesture.
 */
export function wheelDelta(event: WheelLike): number {
  const factor = event.ctrlKey && isMacOs() ? 10 : 1;
  return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) * factor;
}

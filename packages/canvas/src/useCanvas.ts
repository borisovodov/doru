import { useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { CanvasContext, type CanvasContextValue } from './CanvasContext';
import { screenToWorld as toWorld, worldToScreen as toScreen } from './geometry';
import type { FitOptions, Point, Rect, Viewport, ViewportTransitionOptions } from './types';

export interface CanvasApi {
  fit(bounds: Rect, options?: FitOptions): Promise<boolean>;
  setViewport(viewport: Viewport, options?: ViewportTransitionOptions): Promise<boolean>;
  zoomIn(options?: ViewportTransitionOptions): Promise<boolean>;
  zoomOut(options?: ViewportTransitionOptions): Promise<boolean>;
  getViewport(): Viewport;
  /** Converts a point relative to the canvas element. */
  screenToWorld(point: Point): Point;
  /** Converts a browser viewport point (clientX/clientY). */
  clientToWorld(point: Point): Point;
  worldToScreen(point: Point): Point;
}

/** @internal Shared by the canvas components; not part of the public API. */
export function useCanvasContext(): CanvasContextValue {
  const context = useContext(CanvasContext);
  if (context === null) {
    throw new Error('Canvas components must be rendered inside a CanvasProvider');
  }
  return context;
}

/** Imperative viewport API for code that lives inside a CanvasProvider. */
export function useCanvas(): CanvasApi {
  const { store, controllerRef, rootRef } = useCanvasContext();

  const fit = useCallback(
    (bounds: Rect, options?: FitOptions) => controllerRef.current?.fit(bounds, options) ?? Promise.resolve(false),
    [controllerRef],
  );
  const setViewport = useCallback(
    (viewport: Viewport, options?: ViewportTransitionOptions) =>
      controllerRef.current?.setViewport(viewport, options) ?? Promise.resolve(false),
    [controllerRef],
  );
  const zoomIn = useCallback(
    (options?: ViewportTransitionOptions) => controllerRef.current?.zoomIn(options) ?? Promise.resolve(false),
    [controllerRef],
  );
  const zoomOut = useCallback(
    (options?: ViewportTransitionOptions) => controllerRef.current?.zoomOut(options) ?? Promise.resolve(false),
    [controllerRef],
  );
  const getViewport = useCallback(() => store.getSnapshot(), [store]);
  const screenToWorld = useCallback((point: Point) => toWorld(point, store.getSnapshot()), [store]);
  const clientToWorld = useCallback(
    (point: Point) => {
      const rect = rootRef.current?.getBoundingClientRect();
      return toWorld({ x: point.x - (rect?.left ?? 0), y: point.y - (rect?.top ?? 0) }, store.getSnapshot());
    },
    [rootRef, store],
  );
  const worldToScreen = useCallback((point: Point) => toScreen(point, store.getSnapshot()), [store]);

  return useMemo(
    () => ({ fit, setViewport, zoomIn, zoomOut, getViewport, screenToWorld, clientToWorld, worldToScreen }),
    [fit, setViewport, zoomIn, zoomOut, getViewport, screenToWorld, clientToWorld, worldToScreen],
  );
}

/** Subscribes to the viewport; only the caller re-renders on pan/zoom. */
export function useCanvasViewport(): Viewport {
  const { store } = useCanvasContext();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

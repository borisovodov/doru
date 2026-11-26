import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { CanvasContext, type CanvasConfig, type CanvasContextValue, type CanvasController } from './CanvasContext';
import { ViewportStore } from './viewportStore';

export interface CanvasProviderProps {
  minZoom?: number | undefined;
  maxZoom?: number | undefined;
  /** Two-finger scroll pans the world; ctrl+wheel / pinch zooms it. */
  panOnScroll?: boolean | undefined;
  zoomOnPinch?: boolean | undefined;
  /** Dragging the empty pane pans the world. */
  panOnDrag?: boolean | undefined;
  /** Multiplier for wheel panning; d3-zoom default feel is 0.5. */
  panOnScrollSpeed?: number | undefined;
  children: ReactNode;
}

export function CanvasProvider({
  minZoom = 0.1,
  maxZoom = 2,
  panOnScroll = true,
  zoomOnPinch = true,
  panOnDrag = true,
  panOnScrollSpeed = 0.5,
  children,
}: CanvasProviderProps) {
  const store = useMemo(() => new ViewportStore(), []);
  const controllerRef = useRef<CanvasController | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const setController = useCallback((controller: CanvasController | null) => {
    controllerRef.current = controller;
  }, []);
  const config = useMemo<CanvasConfig>(
    () => ({ minZoom, maxZoom, panOnScroll, zoomOnPinch, panOnDrag, panOnScrollSpeed }),
    [minZoom, maxZoom, panOnScroll, zoomOnPinch, panOnDrag, panOnScrollSpeed],
  );
  const value = useMemo<CanvasContextValue>(
    () => ({ store, config, controllerRef, worldRef, setController }),
    [store, config, setController],
  );
  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}

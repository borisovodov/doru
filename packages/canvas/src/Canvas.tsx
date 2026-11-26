import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { pointer, select } from 'd3-selection';
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from 'd3-zoom';
import 'd3-transition';
import type { RefObject } from 'react';
import type { CanvasConfig, CanvasController } from './CanvasContext';
import { clamp, fitViewport, isMacOs, wheelDelta } from './geometry';
import type { FitOptions, Rect, Viewport, ViewportTransitionOptions } from './types';
import { useCanvasContext } from './useCanvas';
import { ViewportStore } from './viewportStore';
import styles from './canvas.module.css';

export interface CanvasProps {
  children?: ReactNode | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  ariaLabel?: string | undefined;
  /** World-space bounds to fit when `fitKey` changes (and on first show). */
  fitBounds?: Rect | undefined;
  /** Change this when the chart shape changes; edits in place keep the camera. */
  fitKey?: string | undefined;
  fitOptions?: FitOptions | undefined;
  onPaneClick?: (() => void) | undefined;
}

interface ControllerHandle {
  controller: CanvasController;
  retryPendingFit(): void;
  destroy(): void;
}

interface PendingFit {
  bounds: Rect;
  options: FitOptions | undefined;
}

const MAX_PANE_CLICK_DISTANCE = 4;

function applyWorldTransform(world: HTMLDivElement | null, viewport: Viewport): void {
  if (!world) {
    return;
  }
  world.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
}

function createCanvasController(
  root: HTMLDivElement,
  store: ViewportStore,
  config: CanvasConfig,
  worldRef: RefObject<HTMLDivElement | null>,
): ControllerHandle {
  const selection = select(root);
  let pendingFit: PendingFit | null = null;
  let retryFrame = 0;

  const applyViewport = (viewport: Viewport): void => {
    store.set(viewport);
    applyWorldTransform(worldRef.current, viewport);
  };

  const zoomBehavior: ZoomBehavior<HTMLDivElement, unknown> = zoom<HTMLDivElement, unknown>()
    .scaleExtent([config.minZoom, config.maxZoom])
    .extent(() => [
      [0, 0],
      [root.clientWidth, root.clientHeight],
    ])
    .filter((event: Event) => {
      if (event.type === 'mousedown') {
        if (!config.panOnDrag) {
          return false;
        }
        if (event instanceof MouseEvent && event.button > 1) {
          return false;
        }
      }
      if (!(event.target instanceof Element)) {
        return true;
      }
      return !event.target.closest(
        '[data-canvas-no-pan], button, a, input, textarea, select, [contenteditable="true"]',
      );
    })
    .wheelDelta(wheelDelta)
    .on('start', (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
      if (event.sourceEvent !== undefined && event.sourceEvent !== null) {
        root.dataset['panning'] = 'true';
      }
    })
    .on('end', (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
      if (event.sourceEvent !== undefined && event.sourceEvent !== null) {
        delete root.dataset['panning'];
      }
    })
    .on('zoom', (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
      applyViewport({ x: event.transform.x, y: event.transform.y, zoom: event.transform.k });
    });

  selection.call(zoomBehavior);
  selection.on('wheel.zoom', null);
  selection.on('dblclick.zoom', null);

  const animatedTarget = (duration: number | undefined) => {
    selection.interrupt();
    return duration !== undefined && duration > 0 ? selection.transition().duration(duration) : selection;
  };

  const setViewportInstant = (viewport: Viewport, options: ViewportTransitionOptions | undefined): Promise<boolean> => {
    const next = { ...viewport, zoom: clamp(viewport.zoom, config.minZoom, config.maxZoom) };
    const transform = zoomIdentity.translate(next.x, next.y).scale(next.zoom);
    animatedTarget(options?.duration).call(zoomBehavior.transform, transform);
    return Promise.resolve(true);
  };

  const fitNow = (bounds: Rect, options: FitOptions | undefined): boolean => {
    const width = root.clientWidth;
    const height = root.clientHeight;
    if (width === 0 || height === 0 || bounds.width <= 0 || bounds.height <= 0) {
      return false;
    }
    const viewport = fitViewport(bounds, width, height, {
      padding: options?.padding,
      minZoom: options?.minZoom ?? config.minZoom,
      maxZoom: options?.maxZoom ?? config.maxZoom,
    });
    void setViewportInstant(viewport, options);
    return true;
  };

  const retryPendingFit = (): void => {
    if (pendingFit === null || retryFrame !== 0) {
      return;
    }
    retryFrame = requestAnimationFrame(() => {
      retryFrame = 0;
      const pending = pendingFit;
      if (pending === null) {
        return;
      }
      pendingFit = null;
      if (!fitNow(pending.bounds, pending.options)) {
        pendingFit = pending;
      }
    });
  };

  const controller: CanvasController = {
    fit: (bounds, options) => {
      if (fitNow(bounds, options)) {
        pendingFit = null;
        return Promise.resolve(true);
      }
      pendingFit = { bounds, options };
      return Promise.resolve(false);
    },
    setViewport: (viewport, options) => {
      if (root.clientWidth === 0 || root.clientHeight === 0) {
        return Promise.resolve(false);
      }
      return setViewportInstant(viewport, options);
    },
    zoomIn: (options) => {
      if (root.clientWidth === 0 || root.clientHeight === 0) {
        return Promise.resolve(false);
      }
      animatedTarget(options?.duration).call(zoomBehavior.scaleBy, 1.2);
      return Promise.resolve(true);
    },
    zoomOut: (options) => {
      if (root.clientWidth === 0 || root.clientHeight === 0) {
        return Promise.resolve(false);
      }
      animatedTarget(options?.duration).call(zoomBehavior.scaleBy, 1 / 1.2);
      return Promise.resolve(true);
    },
  };

  const onWheel = (event: WheelEvent): void => {
    if (event.target instanceof Element && event.target.closest('[data-canvas-no-wheel]')) {
      if (event.ctrlKey) {
        event.preventDefault();
      }
      return;
    }
    const currentZoom = store.getSnapshot().zoom;
    if (event.ctrlKey && config.zoomOnPinch) {
      event.preventDefault();
      selection.interrupt();
      const point = pointer(event, root);
      const nextZoom = clamp(currentZoom * 2 ** wheelDelta(event), config.minZoom, config.maxZoom);
      zoomBehavior.scaleTo(selection, nextZoom, point);
      return;
    }
    if (!config.panOnScroll) {
      return;
    }
    event.preventDefault();
    selection.interrupt();
    const deltaNormalize = event.deltaMode === 1 ? 20 : 1;
    let deltaX = event.deltaX * deltaNormalize;
    let deltaY = event.deltaY * deltaNormalize;
    if (!isMacOs() && event.shiftKey) {
      deltaX = deltaY;
      deltaY = 0;
    }
    zoomBehavior.translateBy(
      selection,
      -(deltaX / currentZoom) * config.panOnScrollSpeed,
      -(deltaY / currentZoom) * config.panOnScrollSpeed,
    );
  };

  root.addEventListener('wheel', onWheel, { passive: false });
  applyViewport(store.getSnapshot());

  return {
    controller,
    retryPendingFit,
    destroy: () => {
      root.removeEventListener('wheel', onWheel);
      selection.on('.zoom', null);
      selection.interrupt();
      delete root.dataset['panning'];
      if (retryFrame !== 0) {
        cancelAnimationFrame(retryFrame);
      }
    },
  };
}

/**
 * The gesture root of the canvas. It owns pan/zoom and the pane click, but
 * renders only its children: the world layer, background, panels and overlays.
 */
export function Canvas({
  children,
  className,
  style,
  ariaLabel,
  fitBounds,
  fitKey,
  fitOptions,
  onPaneClick,
}: CanvasProps) {
  const { store, config, worldRef, setController } = useCanvasContext();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const controllerHandleRef = useRef<ControllerHandle | null>(null);
  const lastFitKey = useRef<string | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const handle = createCanvasController(root, store, config, worldRef);
    controllerHandleRef.current = handle;
    setController(handle.controller);
    const resizeObserver = new ResizeObserver(() => {
      if (root.clientWidth > 0 && root.clientHeight > 0) {
        handle.retryPendingFit();
      }
    });
    resizeObserver.observe(root);
    return () => {
      resizeObserver.disconnect();
      setController(null);
      controllerHandleRef.current = null;
      handle.destroy();
    };
  }, [store, config, worldRef, setController]);

  useLayoutEffect(() => {
    if (fitBounds === undefined || fitKey === undefined) {
      return;
    }
    if (lastFitKey.current === fitKey) {
      return;
    }
    lastFitKey.current = fitKey;
    void controllerHandleRef.current?.controller.fit(fitBounds, fitOptions);
  }, [fitKey, fitBounds, fitOptions]);

  const panePointer = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const suppressPaneClick = useRef(false);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    suppressPaneClick.current = false;
    if (event.button !== 0) {
      return;
    }
    const target = event.target as Element;
    if (target.closest('[data-canvas-item], [data-canvas-panel], [data-canvas-overlay]')) {
      return;
    }
    panePointer.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const start = panePointer.current;
    panePointer.current = null;
    if (start === null || start.pointerId !== event.pointerId) {
      return;
    }
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > MAX_PANE_CLICK_DISTANCE) {
      suppressPaneClick.current = true;
    }
  };

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (suppressPaneClick.current) {
      suppressPaneClick.current = false;
      return;
    }
    const target = event.target as Element;
    if (target.closest('[data-canvas-item], [data-canvas-panel], [data-canvas-overlay]')) {
      return;
    }
    onPaneClick?.();
  };

  return (
    <div
      ref={rootRef}
      className={[styles['canvas'], className].filter(Boolean).join(' ')}
      style={style}
      role={ariaLabel === undefined ? undefined : 'region'}
      aria-label={ariaLabel}
      data-canvas-root
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}

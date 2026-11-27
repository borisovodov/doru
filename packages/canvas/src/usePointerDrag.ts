import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useCanvas } from './useCanvas';

const DEFAULT_THRESHOLD = 4;
const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, [contenteditable="true"], [data-canvas-no-drag]';

export interface PointerDragOptions {
  /** Screen pixels the pointer must travel before a drag starts. */
  threshold?: number | undefined;
  disabled?: boolean | undefined;
  onStart?: (() => void) | undefined;
  onMove?: ((dx: number, dy: number) => void) | undefined;
  onEnd?: ((dx: number, dy: number, cancelled: boolean) => void) | undefined;
}

export interface PointerDragHandlers {
  onPointerDown(event: ReactPointerEvent<HTMLElement>): void;
  onPointerMove(event: ReactPointerEvent<HTMLElement>): void;
  onPointerUp(event: ReactPointerEvent<HTMLElement>): void;
  onPointerCancel(event: ReactPointerEvent<HTMLElement>): void;
}

export interface PointerDragResult {
  handlers: PointerDragHandlers;
  dragging: boolean;
  /** Current drag offset in world units. */
  dx: number;
  dy: number;
  /** True once after a drag; lets the click handler ignore the trailing click. */
  consumeClickSuppression(): boolean;
}

interface DragInternal {
  pointerId: number;
  captureTarget: HTMLElement;
  startX: number;
  startY: number;
  startWorldX: number;
  startWorldY: number;
  dx: number;
  dy: number;
  moved: boolean;
}

/**
 * Pointer-based drag with a gesture threshold, pointer capture and Escape
 * cancellation. It returns offsets in world units; the caller decides what a
 * drop means. Native HTML drag-and-drop is deliberately not used.
 */
export function usePointerDrag(options: PointerDragOptions = {}): PointerDragResult {
  const canvas = useCanvas();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const stateRef = useRef<DragInternal | null>(null);
  const suppressClickRef = useRef(false);
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [drag, setDrag] = useState({ dragging: false, dx: 0, dy: 0 });

  const armClickSuppression = useCallback((): void => {
    suppressClickRef.current = true;
    if (suppressTimerRef.current !== null) {
      clearTimeout(suppressTimerRef.current);
    }
    suppressTimerRef.current = setTimeout(() => {
      suppressClickRef.current = false;
      suppressTimerRef.current = null;
    }, 0);
  }, []);

  const reset = useCallback((): void => {
    stateRef.current = null;
    setDrag({ dragging: false, dx: 0, dy: 0 });
  }, []);

  const releaseCapture = useCallback((state: DragInternal): void => {
    if (state.captureTarget.hasPointerCapture(state.pointerId)) {
      state.captureTarget.releasePointerCapture(state.pointerId);
    }
  }, []);

  const finish = useCallback(
    (cancelled: boolean): void => {
      const state = stateRef.current;
      if (state === null) {
        return;
      }
      releaseCapture(state);
      if (state.moved) {
        armClickSuppression();
        optionsRef.current.onEnd?.(state.dx, state.dy, cancelled);
      }
      reset();
    },
    [armClickSuppression, releaseCapture, reset],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || stateRef.current === null) {
        return;
      }
      const state = stateRef.current;
      event.preventDefault();
      releaseCapture(state);
      if (state.moved) {
        armClickSuppression();
        optionsRef.current.onEnd?.(state.dx, state.dy, true);
      }
      reset();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [armClickSuppression, releaseCapture, reset]);

  useEffect(
    () => () => {
      const state = stateRef.current;
      if (state?.moved) {
        optionsRef.current.onEnd?.(state.dx, state.dy, true);
      }
      stateRef.current = null;
      if (suppressTimerRef.current !== null) {
        clearTimeout(suppressTimerRef.current);
      }
    },
    [],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (optionsRef.current.disabled === true || event.button !== 0 || stateRef.current !== null) {
        return;
      }
      const target = event.target;
      if (target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null) {
        return;
      }
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const startWorld = canvas.clientToWorld({ x: event.clientX, y: event.clientY });
      stateRef.current = {
        pointerId: event.pointerId,
        captureTarget: event.currentTarget,
        startX: event.clientX,
        startY: event.clientY,
        startWorldX: startWorld.x,
        startWorldY: startWorld.y,
        dx: 0,
        dy: 0,
        moved: false,
      };
    },
    [canvas],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      const state = stateRef.current;
      if (state === null || state.pointerId !== event.pointerId) {
        return;
      }
      if (!state.moved) {
        const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
        if (distance < (optionsRef.current.threshold ?? DEFAULT_THRESHOLD)) {
          return;
        }
        state.moved = true;
        optionsRef.current.onStart?.();
      }
      event.preventDefault();
      const current = canvas.clientToWorld({ x: event.clientX, y: event.clientY });
      state.dx = current.x - state.startWorldX;
      state.dy = current.y - state.startWorldY;
      setDrag({ dragging: true, dx: state.dx, dy: state.dy });
      optionsRef.current.onMove?.(state.dx, state.dy);
    },
    [canvas],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      const state = stateRef.current;
      if (state === null || state.pointerId !== event.pointerId) {
        return;
      }
      if (state.moved) {
        // The last pointermove can be coalesced into pointerup. Resolve the
        // final position here so the drop target uses the release coordinates.
        const current = canvas.clientToWorld({ x: event.clientX, y: event.clientY });
        state.dx = current.x - state.startWorldX;
        state.dy = current.y - state.startWorldY;
      }
      finish(false);
    },
    [canvas, finish],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      const state = stateRef.current;
      if (state === null || state.pointerId !== event.pointerId) {
        return;
      }
      finish(true);
    },
    [finish],
  );

  const consumeClickSuppression = useCallback((): boolean => {
    if (!suppressClickRef.current) {
      return false;
    }
    suppressClickRef.current = false;
    if (suppressTimerRef.current !== null) {
      clearTimeout(suppressTimerRef.current);
      suppressTimerRef.current = null;
    }
    return true;
  }, []);

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    dragging: drag.dragging,
    dx: drag.dx,
    dy: drag.dy,
    consumeClickSuppression,
  };
}

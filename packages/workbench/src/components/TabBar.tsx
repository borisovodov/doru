import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { nls } from '../nls';
import { dropIndexForTabs } from '../tabReorder';

export interface TabInfo {
  id: string;
  label: string;
  closable?: boolean;
}

export interface TabBarProps {
  tabs: TabInfo[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  /** When provided, tabs can be reordered by dragging; drops call this with the insertion index. */
  onReorder?: (sourceId: string, dropIndex: number) => void;
}

interface DragState {
  draggedId: string;
  hoverIndex: number;
  before: boolean;
}

interface PointerState {
  draggedId: string;
  pointerId: number;
  startX: number;
  started: boolean;
}

/** Horizontal pointer travel required before a press turns into a drag. */
const DRAG_THRESHOLD_PX = 4;

/**
 * Reordering uses pointer events instead of the native HTML5 drag session:
 * Electron on macOS draws the OS copy cursor (green plus badge) for the first
 * frames of a native drag regardless of `effectAllowed`, and pointer capture
 * gives us full control of both the cursor and the drop indicator.
 */
export function TabBar({ tabs, activeId, onSelect, onClose, onReorder }: TabBarProps) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const ghostGrabRef = useRef({ offsetX: 0, offsetY: 0 });
  const pointerRef = useRef<PointerState | null>(null);
  const suppressClickRef = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  // Latest props for the event handlers, which only ever see their own tab id.
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const reorderRef = useRef(onReorder);
  reorderRef.current = onReorder;

  const hideGhost = () => {
    ghostRef.current?.classList.remove('visible');
  };

  // Grab cursor across the whole window for the length of the gesture.
  useEffect(() => {
    if (!drag) {
      return;
    }
    document.body.classList.add('tab-reordering');
    return () => document.body.classList.remove('tab-reordering');
  }, [drag]);

  // Escape cancels the gesture.
  useEffect(() => {
    if (!drag) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        pointerRef.current = null;
        setDrag(null);
        hideGhost();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drag]);

  if (tabs.length === 0) {
    return null;
  }

  const computeHover = (clientX: number): { hoverIndex: number; before: boolean } => {
    const bar = barRef.current;
    const count = tabsRef.current.length;
    if (!bar) {
      return { hoverIndex: count - 1, before: false };
    }
    const tabsUnder = Array.from(bar.querySelectorAll<HTMLElement>('.tab'));
    let hoverIndex = tabsUnder.length - 1;
    let before = false;
    for (let index = 0; index < tabsUnder.length; index++) {
      const rect = tabsUnder[index]?.getBoundingClientRect();
      if (rect && clientX < rect.left + rect.width / 2) {
        hoverIndex = index;
        before = true;
        break;
      }
    }
    return { hoverIndex, before };
  };

  const onPointerDown = (tabId: string) => (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    if ((event.target as HTMLElement).closest('.tab-close')) {
      return;
    }
    // Pressing a tab activates it immediately, like VS Code — so the dragged
    // tab is always the active one, during and after the reorder.
    onSelect(tabId);
    if (!reorderRef.current) {
      return;
    }
    pointerRef.current = {
      draggedId: tabId,
      pointerId: event.pointerId,
      startX: event.clientX,
      started: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const showGhost = (tabId: string, pointerX: number, pointerY: number, tabEl: HTMLDivElement) => {
    const ghost = ghostRef.current;
    if (!ghost) {
      return;
    }
    ghost.textContent = tabsRef.current.find((tab) => tab.id === tabId)?.label ?? '';
    // Keep the grab point inside the ghost, like the native drag image would.
    const rect = tabEl.getBoundingClientRect();
    ghostGrabRef.current = { offsetX: pointerX - rect.left, offsetY: pointerY - rect.top };
    ghost.style.transform = `translate(${pointerX - ghostGrabRef.current.offsetX}px, ${pointerY - ghostGrabRef.current.offsetY}px)`;
    ghost.classList.add('visible');
  };

  const onPointerMove = (tabId: string) => (event: PointerEvent<HTMLDivElement>) => {
    const state = pointerRef.current;
    if (!state || state.draggedId !== tabId || state.pointerId !== event.pointerId) {
      return;
    }
    if (!state.started) {
      if (Math.abs(event.clientX - state.startX) < DRAG_THRESHOLD_PX) {
        return;
      }
      state.started = true;
      suppressClickRef.current = true;
      showGhost(tabId, event.clientX, event.clientY, event.currentTarget);
    }
    const ghost = ghostRef.current;
    if (ghost && state.started) {
      ghost.style.transform = `translate(${event.clientX - ghostGrabRef.current.offsetX}px, ${event.clientY - ghostGrabRef.current.offsetY}px)`;
    }
    const { hoverIndex, before } = computeHover(event.clientX);
    setDrag({ draggedId: tabId, hoverIndex, before });
  };

  const finishDrag = (tabId: string) => (event: PointerEvent<HTMLDivElement>) => {
    const state = pointerRef.current;
    pointerRef.current = null;
    setDrag(null);
    hideGhost();
    if (!state || state.draggedId !== tabId || state.pointerId !== event.pointerId || !state.started) {
      return;
    }
    const { hoverIndex, before } = computeHover(event.clientX);
    const dropIndex = dropIndexForTabs(tabsRef.current, state.draggedId, hoverIndex, before);
    if (dropIndex !== null) {
      reorderRef.current?.(state.draggedId, dropIndex);
    }
  };

  const draggedIndex = drag ? tabs.findIndex((tab) => tab.id === drag.draggedId) : -1;

  return (
    <div className="tab-bar" ref={barRef}>
      {tabs.map((tab, index) => {
        const isDragged = drag !== null && drag.draggedId === tab.id;
        const isDropTarget =
          drag !== null && drag.hoverIndex === index && index !== draggedIndex;
        const className = [
          'tab',
          tab.id === activeId ? 'active' : '',
          isDragged ? 'dragging' : '',
          isDropTarget ? (drag!.before ? 'drop-before' : 'drop-after') : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <div
            key={tab.id}
            className={className}
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              onSelect(tab.id);
            }}
            onPointerDown={onPointerDown(tab.id)}
            onPointerMove={onPointerMove(tab.id)}
            onPointerUp={finishDrag(tab.id)}
            onPointerCancel={finishDrag(tab.id)}
          >
            <span className="tab-label">{tab.label}</span>
            {tab.closable !== false && (
              <button
                className="tab-close"
                title={nls.t('workbench.tab.close')}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(tab.id);
                }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <div className="tab-drag-ghost" ref={ghostRef} aria-hidden="true" />
    </div>
  );
}

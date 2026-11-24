import {
  cloneElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../lib/cx';
import { Kbd } from '../display/Kbd';
import styles from './Tooltip.module.css';

export type TooltipPlacement = 'top' | 'right';

interface TriggerProps {
  'aria-describedby'?: string | undefined;
  onMouseEnter?: ((event: MouseEvent<HTMLElement>) => void) | undefined;
  onMouseLeave?: ((event: MouseEvent<HTMLElement>) => void) | undefined;
  onFocus?: ((event: FocusEvent<HTMLElement>) => void) | undefined;
  onBlur?: ((event: FocusEvent<HTMLElement>) => void) | undefined;
  onKeyDown?: ((event: KeyboardEvent<HTMLElement>) => void) | undefined;
  onClick?: ((event: MouseEvent<HTMLElement>) => void) | undefined;
  onPointerDown?: ((event: PointerEvent<HTMLElement>) => void) | undefined;
}

export interface TooltipProps {
  label: string;
  children: ReactElement;
  shortcut?: string | undefined;
  delay?: number | undefined;
  placement?: TooltipPlacement | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
}

const DEFAULT_DELAY_MS = 600;
const VIEWPORT_PADDING = 8;
const GAP = 8;

interface AnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface Position {
  left: number;
  top: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function positionFor(anchor: AnchorRect, width: number, height: number, placement: TooltipPlacement): Position {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (placement === 'right') {
    let left = anchor.right + GAP;
    if (left + width > viewportWidth - VIEWPORT_PADDING) {
      left = anchor.left - GAP - width;
    }
    return {
      left: clamp(left, VIEWPORT_PADDING, viewportWidth - VIEWPORT_PADDING - width),
      top: clamp(
        anchor.top + anchor.height / 2 - height / 2,
        VIEWPORT_PADDING,
        viewportHeight - VIEWPORT_PADDING - height,
      ),
    };
  }

  let top = anchor.top - GAP - height;
  if (top < VIEWPORT_PADDING) {
    top = anchor.bottom + GAP;
  }
  return {
    left: clamp(anchor.left + anchor.width / 2 - width / 2, VIEWPORT_PADDING, viewportWidth - VIEWPORT_PADDING - width),
    top: clamp(top, VIEWPORT_PADDING, viewportHeight - VIEWPORT_PADDING - height),
  };
}

/**
 * A delayed tooltip. Native `title` is unreliable under the macOS drag
 * region, so the app draws its own pill. The trigger is cloned rather than
 * wrapped: a wrapper would break absolutely positioned icon buttons and
 * `margin-top: auto` layout. The pill is portalled to the document body so
 * scroll containers never clip it.
 */
export function Tooltip({
  label,
  children,
  shortcut,
  delay = DEFAULT_DELAY_MS,
  placement = 'top',
  className,
  disabled = false,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const id = useId();

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const hide = () => {
      setOpen(false);
      setAnchor(null);
      setPosition(null);
    };
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || anchor === null) {
      return;
    }
    const element = tooltipRef.current;
    if (element === null) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const next = positionFor(anchor, rect.width, rect.height, placement);
    setPosition((current) =>
      current !== null && current.left === next.left && current.top === next.top ? current : next,
    );
  }, [open, anchor, placement, label, shortcut]);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const hide = () => {
    clearTimer();
    setOpen(false);
    setAnchor(null);
    setPosition(null);
  };

  const show = (element: HTMLElement) => {
    if (disabled) {
      return;
    }
    clearTimer();
    timerRef.current = setTimeout(() => {
      const rect = element.getBoundingClientRect();
      setAnchor({
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      });
      setPosition(null);
      setOpen(true);
    }, delay);
  };

  const trigger = children as ReactElement<TriggerProps>;
  const triggerProps = trigger.props;
  const describedBy = [triggerProps['aria-describedby'], open ? id : undefined].filter(Boolean).join(' ');

  const style: CSSProperties =
    position === null ? { left: 0, top: 0, visibility: 'hidden' } : { left: position.left, top: position.top };

  return (
    <>
      {/* oxlint-disable-next-line react/no-clone-element, react/refs -- the tooltip must not add a layout wrapper */}
      {cloneElement(trigger, {
        'aria-describedby': describedBy === '' ? undefined : describedBy,
        onMouseEnter: (event: MouseEvent<HTMLElement>) => {
          triggerProps.onMouseEnter?.(event);
          show(event.currentTarget);
        },
        onMouseLeave: (event: MouseEvent<HTMLElement>) => {
          triggerProps.onMouseLeave?.(event);
          hide();
        },
        onFocus: (event: FocusEvent<HTMLElement>) => {
          triggerProps.onFocus?.(event);
          show(event.currentTarget);
        },
        onBlur: (event: FocusEvent<HTMLElement>) => {
          triggerProps.onBlur?.(event);
          hide();
        },
        onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
          triggerProps.onKeyDown?.(event);
          if (event.key === 'Escape') {
            hide();
          }
        },
        onClick: (event: MouseEvent<HTMLElement>) => {
          triggerProps.onClick?.(event);
          hide();
        },
        onPointerDown: (event: PointerEvent<HTMLElement>) => {
          triggerProps.onPointerDown?.(event);
          hide();
        },
      })}
      {open
        ? createPortal(
            <span id={id} ref={tooltipRef} role="tooltip" className={cx(styles['tooltip'], className)} style={style}>
              <span className={styles['label']}>{label}</span>
              {shortcut !== undefined ? <Kbd>{shortcut}</Kbd> : null}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  label: string;
  children: ReactNode;
  delay?: number;
  className?: string;
}

/**
 * A delayed tooltip. Native `title` is unreliable under the macOS drag
 * region, so the app draws its own pill.
 */
export function Tooltip({ label, children, delay = 600, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const show = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setOpen(true), delay);
  };

  const hide = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
  };

  return (
    <span
      className={cx(styles['root'], className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open ? (
        <span className={styles['tooltip']} role="tooltip">
          {label}
        </span>
      ) : null}
    </span>
  );
}

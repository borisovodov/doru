import type { FocusEventHandler, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './EditorPage.module.css';

export interface EditorPageProps {
  /** Accessible name of the editor tab. */
  label?: string;
  children: ReactNode;
  className?: string;
  /** Observes focus leaving fields inside the editor (for autosave). */
  onBlur?: FocusEventHandler<HTMLElement> | undefined;
}

/** The shared width and padding of an entity editor tab. */
export function EditorPage({ label, children, className, onBlur }: EditorPageProps) {
  return (
    <section className={cx(styles['page'], className)} aria-label={label} onBlur={onBlur}>
      {children}
    </section>
  );
}

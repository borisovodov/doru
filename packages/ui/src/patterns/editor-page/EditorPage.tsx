import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './EditorPage.module.css';

export interface EditorPageProps {
  /** Accessible name of the editor tab. */
  label?: string;
  children: ReactNode;
  className?: string;
}

/** The shared width and padding of an entity editor tab. */
export function EditorPage({ label, children, className }: EditorPageProps) {
  return (
    <section className={cx(styles['page'], className)} aria-label={label}>
      {children}
    </section>
  );
}

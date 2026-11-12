import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './SectionCard.module.css';

export interface SectionCardProps {
  title: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** The raised card that groups one editor section. */
export function SectionCard({ title, actions, className, children }: SectionCardProps) {
  return (
    <section className={cx(styles['section'], className)} aria-label={title}>
      <header className={styles['header']}>
        <h3 className={styles['title']}>{title}</h3>
        {actions ? <div className={styles['actions']}>{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

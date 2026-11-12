import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './FieldGrid.module.css';

export interface FieldGridProps {
  columns?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
}

/** A compact form grid that collapses to one column on narrow panels. */
export function FieldGrid({ columns = 2, className, children }: FieldGridProps) {
  return <div className={cx(styles['grid'], styles[`columns${columns}`], className)}>{children}</div>;
}

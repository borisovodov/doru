import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Subcard.module.css';

export interface SubcardProps {
  children: ReactNode;
  className?: string;
}

/** A nested card inside a section: a link block, a fact form, a task item. */
export function Subcard({ children, className }: SubcardProps) {
  return <div className={cx(styles['subcard'], className)}>{children}</div>;
}

import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './ActionBar.module.css';

export interface ActionBarProps {
  children: ReactNode;
  className?: string;
}

/** A row of form actions: save, cancel, delete and friends. */
export function ActionBar({ children, className }: ActionBarProps) {
  return <div className={cx(styles['bar'], className)}>{children}</div>;
}

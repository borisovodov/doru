import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './SideBarList.module.css';

export interface SideBarListProps {
  children: ReactNode;
  className?: string;
}

/** The full-width, zero-gap stack used by side-bar entity lists. */
export function SideBarList({ children, className }: SideBarListProps) {
  return <ul className={cx(styles['list'], className)}>{children}</ul>;
}

import type { ReactNode } from 'react';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { cx } from '../../lib/cx';
import styles from './SideBarEmpty.module.css';

export interface SideBarEmptyProps {
  children: ReactNode;
  className?: string;
}

/** The muted, correctly inset message for an empty side-bar list. */
export function SideBarEmpty({ children, className }: SideBarEmptyProps) {
  return <EmptyText className={cx(styles['empty'], className)}>{children}</EmptyText>;
}

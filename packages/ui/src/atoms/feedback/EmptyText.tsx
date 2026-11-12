import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './feedback.module.css';

export interface EmptyTextProps {
  className?: string;
  children: ReactNode;
}

/** Muted text for an empty list, section or placeholder. */
export function EmptyText({ className, children }: EmptyTextProps) {
  return <p className={cx(styles['empty'], className)}>{children}</p>;
}

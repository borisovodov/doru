import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './display.module.css';

export interface BadgeProps {
  icon?: ReactNode;
  title?: string;
  className?: string;
  children: ReactNode;
}

/** A compact icon + count badge used on cards and entity headers. */
export function Badge({ icon, title, className, children }: BadgeProps) {
  return (
    <span className={cx(styles['badge'], className)} title={title}>
      {icon}
      <span>{children}</span>
    </span>
  );
}

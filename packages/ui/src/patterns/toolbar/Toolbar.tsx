import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Toolbar.module.css';

export interface ToolbarProps {
  label?: string;
  className?: string;
  children: ReactNode;
}

/** A compact surface that groups related controls. */
export function Toolbar({ label, className, children }: ToolbarProps) {
  return (
    <div className={cx(styles['toolbar'], className)} role="toolbar" aria-label={label}>
      {children}
    </div>
  );
}

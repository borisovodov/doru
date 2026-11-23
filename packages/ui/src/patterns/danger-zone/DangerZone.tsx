import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './DangerZone.module.css';

/** The quiet footer for destructive page-level actions such as Delete. */
export function DangerZone({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles['zone'], className)}>{children}</div>;
}

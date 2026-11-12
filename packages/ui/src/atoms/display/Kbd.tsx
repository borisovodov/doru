import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './display.module.css';

export interface KbdProps {
  className?: string;
  children: ReactNode;
}

export function Kbd({ className, children }: KbdProps) {
  return <kbd className={cx(styles['kbd'], className)}>{children}</kbd>;
}

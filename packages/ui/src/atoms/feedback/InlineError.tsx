import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './feedback.module.css';

export interface InlineErrorProps {
  className?: string;
  children: ReactNode;
}

export function InlineError({ className, children }: InlineErrorProps) {
  return (
    <p className={cx(styles['error'], className)} role="alert">
      {children}
    </p>
  );
}

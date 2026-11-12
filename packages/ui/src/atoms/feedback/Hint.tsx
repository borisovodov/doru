import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './feedback.module.css';

export interface HintProps {
  className?: string;
  children: ReactNode;
}

/** Secondary explanatory text under a control or section. */
export function Hint({ className, children }: HintProps) {
  return <p className={cx(styles['hint'], className)}>{children}</p>;
}

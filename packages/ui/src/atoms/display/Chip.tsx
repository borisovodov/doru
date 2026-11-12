import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './display.module.css';

export type ChipVariant = 'accent' | 'neutral';

export interface ChipProps {
  variant?: ChipVariant;
  className?: string;
  children: ReactNode;
}

/** A small pill for tags, categories and dates. */
export function Chip({ variant = 'accent', className, children }: ChipProps) {
  return <span className={cx(styles['chip'], styles[`chip-${variant}`], className)}>{children}</span>;
}

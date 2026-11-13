import { cx } from '../../lib/cx';
import styles from './feedback.module.css';

export interface ProgressProps {
  value: number;
  max: number;
  label?: string;
  className?: string;
}

/** The shared determinate progress bar. */
export function Progress({ value, max, label, className }: ProgressProps) {
  return <progress className={cx(styles['progress'], className)} value={value} max={max} aria-label={label} />;
}

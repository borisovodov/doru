import { cx } from '../../lib/cx';
import styles from './display.module.css';

export interface DividerProps {
  className?: string;
}

export function Divider({ className }: DividerProps) {
  return <hr className={cx(styles['divider'], className)} />;
}

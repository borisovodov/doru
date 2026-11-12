import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './RowList.module.css';

export interface RowListProps {
  className?: string;
  children: ReactNode;
}

/** A compact list of attachment rows, separated by hairlines. */
export function RowList({ className, children }: RowListProps) {
  return <ul className={cx(styles['list'], className)}>{children}</ul>;
}

export interface AttachmentRowProps {
  kind?: string;
  value: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** One kind/value row with its edit and remove actions. */
export function AttachmentRow({ kind, value, actions, className }: AttachmentRowProps) {
  return (
    <li className={cx(styles['row'], className)}>
      {kind ? <span className={styles['kind']}>{kind}</span> : null}
      <span className={styles['value']}>{value}</span>
      {actions ? <span className={styles['actions']}>{actions}</span> : null}
    </li>
  );
}

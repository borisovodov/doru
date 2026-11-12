import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './InlineForm.module.css';

export interface InlineFormProps {
  className?: string;
  children: ReactNode;
}

/** A one-line row that pairs a field with its action button. */
export function InlineForm({ className, children }: InlineFormProps) {
  return <div className={cx(styles['row'], className)}>{children}</div>;
}

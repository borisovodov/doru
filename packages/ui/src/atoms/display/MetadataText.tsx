import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './display.module.css';

/** Small muted text for metadata lines inside cards and lists. */
export function MetadataText({ className, children }: { className?: string | undefined; children: ReactNode }) {
  return <span className={cx(styles['metadataText'], className)}>{children}</span>;
}

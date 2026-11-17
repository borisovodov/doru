import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './SideBarHeading.module.css';

export interface SideBarHeadingProps {
  /** Visible name of the side bar view, usually the activity bar label. */
  title: string;
  /** Trailing actions, e.g. the add button of a list view. */
  actions?: ReactNode;
  className?: string | undefined;
}

/** The persistent title row at the top of a workbench side bar. */
export function SideBarHeading({ title, actions, className }: SideBarHeadingProps) {
  return (
    <div className={cx(styles['heading'], className)}>
      <h3 className={styles['title']}>{title}</h3>
      {actions !== undefined && <div className={styles['actions']}>{actions}</div>}
    </div>
  );
}

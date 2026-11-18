import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { SideBarHeading } from '../side-bar-heading/SideBarHeading';
import styles from './SideBarLayout.module.css';

export interface SideBarLayoutProps {
  /** Visible name of the side bar view, usually the activity bar label. */
  title: string;
  /** Trailing actions in the title row, e.g. the add button of a list view. */
  actions?: ReactNode;
  /** A fixed block below the title, e.g. the Sources segments or the search field. */
  subheader?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * The shared side bar scaffold: a persistent title row, an optional fixed
 * subheader and a scrollable body. The title never scrolls away with the list.
 */
export function SideBarLayout({ title, actions, subheader, className, children }: SideBarLayoutProps) {
  return (
    <div className={cx(styles['view'], className)}>
      <SideBarHeading className={styles['heading']} title={title} actions={actions} />
      {subheader !== undefined && subheader !== null && <div className={styles['subheader']}>{subheader}</div>}
      <div className={styles['body']}>{children}</div>
    </div>
  );
}

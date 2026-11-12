import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './EntityViewCard.module.css';

export interface EntityViewCardProps {
  /** Avatar, icon tile or thumbnail. */
  media?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** The header card shared by every entity editor. */
export function EntityViewCard({ media, title, subtitle, badges, actions, className }: EntityViewCardProps) {
  return (
    <section className={cx(styles['card'], className)}>
      {media ? <div className={styles['media']}>{media}</div> : null}
      <div className={styles['body']}>
        <h2 className={styles['title']}>{title}</h2>
        {subtitle ? <p className={styles['subtitle']}>{subtitle}</p> : null}
      </div>
      {badges ? <div className={styles['badges']}>{badges}</div> : null}
      {actions ? <div className={styles['actions']}>{actions}</div> : null}
    </section>
  );
}

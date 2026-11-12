import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './EntityCard.module.css';

export interface EntityCardProps {
  icon?: ReactNode;
  thumbnail?: { src: string; alt: string };
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * The compact entity row used by side-bar lists. Clickable rows render as
 * real buttons so role-based tests and keyboard users see the same control.
 */
export function EntityCard({ icon, thumbnail, title, subtitle, meta, onClick, className }: EntityCardProps) {
  const content = (
    <>
      {thumbnail ? (
        <img className={styles['thumb']} src={thumbnail.src} alt={thumbnail.alt} />
      ) : icon ? (
        <span className={styles['icon']}>{icon}</span>
      ) : null}
      <span className={styles['body']}>
        <span className={styles['title']}>{title}</span>
        {subtitle ? <span className={styles['subtitle']}>{subtitle}</span> : null}
      </span>
      {meta ? <span className={styles['meta']}>{meta}</span> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={cx(styles['card'], styles['clickable'], className)} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={cx(styles['card'], className)}>{content}</div>;
}

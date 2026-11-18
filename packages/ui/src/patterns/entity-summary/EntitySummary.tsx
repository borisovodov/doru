import type { ReactNode } from 'react';
import { hasContent } from '../../lib/content';
import { cx } from '../../lib/cx';
import styles from './EntitySummary.module.css';

export interface EntitySummaryProps {
  icon?: ReactNode;
  thumbnail?: { src: string; alt: string } | undefined;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  iconVariant?: 'framed' | 'plain';
}

/**
 * Shared icon/thumbnail, title, subtitle and meta block for the entity card
 * and entity row shells. Internal to the pattern layer.
 */
export function EntitySummary({ icon, thumbnail, title, subtitle, meta, iconVariant = 'framed' }: EntitySummaryProps) {
  return (
    <>
      {thumbnail ? (
        <img className={styles['thumb']} src={thumbnail.src} alt={thumbnail.alt} />
      ) : icon ? (
        <span className={cx(styles['icon'], iconVariant === 'plain' && styles['iconPlain'])}>{icon}</span>
      ) : null}
      <span className={styles['body']}>
        <span className={styles['title']}>{title}</span>
        {hasContent(subtitle) ? <span className={styles['subtitle']}>{subtitle}</span> : null}
      </span>
      {hasContent(meta) ? <span className={styles['meta']}>{meta}</span> : null}
    </>
  );
}

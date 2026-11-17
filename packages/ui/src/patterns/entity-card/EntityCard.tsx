import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { EntitySummary } from '../entity-summary/EntitySummary';
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
 * The compact entity card used inside editors. Clickable cards render as
 * real buttons so role-based tests and keyboard users see the same control.
 */
export function EntityCard({ icon, thumbnail, title, subtitle, meta, onClick, className }: EntityCardProps) {
  const content = <EntitySummary icon={icon} thumbnail={thumbnail} title={title} subtitle={subtitle} meta={meta} />;

  if (onClick) {
    return (
      <button type="button" className={cx(styles['card'], styles['clickable'], className)} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={cx(styles['card'], className)}>{content}</div>;
}

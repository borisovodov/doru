import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { EntitySummary } from '../entity-summary/EntitySummary';
import styles from './EntityRow.module.css';

export interface EntityRowProps {
  icon?: ReactNode;
  thumbnail?: { src: string; alt: string };
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  onClick?: () => void;
  /** `framed` puts the icon on a shared tile; `plain` lets a circle avatar stand alone. */
  iconVariant?: 'framed' | 'plain';
  /** Marks the row as the current selection in a side-bar list. */
  selected?: boolean;
  className?: string;
}

/**
 * A full-width side-bar list row: no frame, no vertical gap and a hover or
 * selection background that covers the whole row, like the VS Code
 * Extensions list. Clickable rows render as real buttons.
 */
export function EntityRow({
  icon,
  thumbnail,
  title,
  subtitle,
  meta,
  onClick,
  iconVariant = 'framed',
  selected = false,
  className,
}: EntityRowProps) {
  const content = (
    <EntitySummary
      icon={icon}
      thumbnail={thumbnail}
      title={title}
      subtitle={subtitle}
      meta={meta}
      iconVariant={iconVariant}
    />
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cx(styles['row'], styles['clickable'], selected && styles['selected'], className)}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div className={cx(styles['row'], selected && styles['selected'], className)}>{content}</div>;
}

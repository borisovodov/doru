import { Trash2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { cx } from '../../lib/cx';
import styles from './MediaTile.module.css';

export interface MediaTileProps {
  src: string;
  alt: string;
  onOpen?: () => void;
  openLabel?: string;
  onRemove?: () => void;
  removeLabel?: string;
  onDetach?: () => void;
  detachLabel?: string;
  badge?: string;
  muted?: boolean;
  className?: string;
  /** Shown instead of the image for non-previewable (external or non-image) media. */
  fallback?: ReactNode;
}

/** A square media thumbnail with optional open and remove actions. */
export function MediaTile({
  src,
  alt,
  onOpen,
  openLabel,
  onRemove,
  removeLabel,
  onDetach,
  detachLabel,
  badge,
  muted,
  className,
  fallback,
}: MediaTileProps) {
  const image =
    src !== '' ? (
      <img src={src} alt={alt} loading="lazy" />
    ) : (
      <span className={styles['fallback']} role="img" aria-label={alt}>
        {fallback}
      </span>
    );
  const openName = openLabel === undefined || alt === '' ? (openLabel ?? alt) : `${openLabel}: ${alt}`;
  return (
    <figure className={cx(styles['tile'], muted === true && styles['muted'], className)}>
      {onOpen ? (
        <button type="button" className={styles['open']} aria-label={openName} onClick={onOpen}>
          {image}
        </button>
      ) : (
        image
      )}
      {badge !== undefined ? <span className={styles['badge']}>{badge}</span> : null}
      {onDetach !== undefined || onRemove !== undefined ? (
        <span className={styles['actions']}>
          {onDetach !== undefined ? (
            <IconButton
              className={styles['action']}
              size="sm"
              label={detachLabel ?? 'Detach'}
              icon={<X size={13} aria-hidden="true" />}
              onClick={onDetach}
            />
          ) : null}
          {onRemove !== undefined ? (
            <IconButton
              className={styles['action']}
              size="sm"
              variant="danger"
              label={removeLabel ?? 'Remove'}
              icon={<Trash2 size={13} aria-hidden="true" />}
              onClick={onRemove}
            />
          ) : null}
        </span>
      ) : null}
    </figure>
  );
}

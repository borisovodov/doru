import { X } from 'lucide-react';
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
  badge,
  muted,
  className,
  fallback,
}: MediaTileProps) {
  const image =
    src !== '' ? <img src={src} alt={alt} loading="lazy" /> : <span className={styles['fallback']}>{fallback}</span>;
  return (
    <figure className={cx(styles['tile'], muted === true && styles['muted'], className)}>
      {onOpen ? (
        <button type="button" className={styles['open']} aria-label={openLabel} onClick={onOpen}>
          {image}
        </button>
      ) : (
        image
      )}
      {badge !== undefined ? <span className={styles['badge']}>{badge}</span> : null}
      {onRemove ? (
        <IconButton
          className={styles['remove']}
          size="sm"
          variant="danger"
          label={removeLabel ?? 'Remove'}
          icon={<X size={13} aria-hidden="true" />}
          onClick={onRemove}
        />
      ) : null}
    </figure>
  );
}

import { X } from 'lucide-react';
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
  className?: string;
}

/** A square media thumbnail with optional open and remove actions. */
export function MediaTile({ src, alt, onOpen, openLabel, onRemove, removeLabel, className }: MediaTileProps) {
  const image = <img src={src} alt={alt} loading="lazy" />;
  return (
    <figure className={cx(styles['tile'], className)}>
      {onOpen ? (
        <button type="button" className={styles['open']} aria-label={openLabel} onClick={onOpen}>
          {image}
        </button>
      ) : (
        image
      )}
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

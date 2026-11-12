import { X } from 'lucide-react';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { cx } from '../../lib/cx';
import styles from './MediaTile.module.css';

export interface MediaTileProps {
  src: string;
  alt: string;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
}

/** A square media thumbnail with an optional remove action. */
export function MediaTile({ src, alt, onRemove, removeLabel, className }: MediaTileProps) {
  return (
    <figure className={cx(styles['tile'], className)}>
      <img src={src} alt={alt} loading="lazy" />
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

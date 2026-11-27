import { Star, Trash2, Unlink } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { cx } from '../../lib/cx';
import { nls } from '../../nls';
import styles from './MediaTile.module.css';

interface MediaTileBaseProps {
  src: string;
  alt: string;
  onOpen?: () => void;
  openLabel?: string;
  onRemove?: () => void;
  removeLabel?: string;
  /** Marks this tile as the target's main media; disables the star action. */
  primary?: boolean;
  onPrimary?: () => void;
  primaryLabel?: string;
  muted?: boolean;
  className?: string;
  /** Shown instead of the image for non-previewable (external or non-image) media. */
  fallback?: ReactNode;
}

type MediaTileDetachProps = { onDetach: () => void; detachLabel: string };
type MediaTileNoDetachProps = { onDetach?: undefined; detachLabel?: undefined };

export type MediaTileProps = MediaTileBaseProps & (MediaTileDetachProps | MediaTileNoDetachProps);

/** A square media thumbnail with optional open and remove actions. */
export function MediaTile(props: MediaTileProps) {
  const {
    src,
    alt,
    onOpen,
    openLabel,
    onRemove,
    removeLabel,
    primary = false,
    onPrimary,
    primaryLabel,
    muted,
    className,
    fallback,
  } = props;
  const detach = props.onDetach !== undefined ? { onClick: props.onDetach, label: props.detachLabel } : undefined;
  const image =
    src !== '' ? (
      <img src={src} alt={alt} loading="lazy" />
    ) : (
      <span className={styles['fallback']} role="img" aria-label={alt}>
        {fallback}
      </span>
    );
  const openName = openLabel === undefined || alt === '' ? (openLabel ?? alt) : `${openLabel}: ${alt}`;
  const primaryLabelText = primaryLabel ?? nls.t('features.tree.media.primary');
  return (
    <figure className={cx(styles['tile'], muted === true && styles['muted'], className)}>
      {onOpen ? (
        <button type="button" className={styles['open']} aria-label={openName} onClick={onOpen}>
          {image}
        </button>
      ) : (
        image
      )}
      {primary ? (
        <span className={styles['primary']} role="img" aria-label={primaryLabelText}>
          <Star size={14} fill="currentColor" aria-hidden="true" />
        </span>
      ) : onPrimary !== undefined ? (
        <IconButton
          className={cx(styles['action'], styles['primaryAction'])}
          size="sm"
          label={primaryLabelText}
          icon={<Star size={13} aria-hidden="true" />}
          onClick={onPrimary}
        />
      ) : null}
      {detach !== undefined || onRemove !== undefined ? (
        <span className={styles['actions']}>
          {detach !== undefined ? (
            <IconButton
              className={styles['action']}
              size="sm"
              label={detach.label}
              icon={<Unlink size={13} aria-hidden="true" />}
              onClick={detach.onClick}
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

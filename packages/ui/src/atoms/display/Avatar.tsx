import { cx } from '../../lib/cx';
import styles from './display.module.css';

export type AvatarTone = 'neutral' | 'male' | 'female';
export type AvatarSize = 'sm' | 'md' | 'lg';
export type AvatarShape = 'rounded' | 'circle';

export interface AvatarProps {
  initials: string;
  tone?: AvatarTone;
  size?: AvatarSize;
  shape?: AvatarShape;
  /** A project media URL; when present it replaces the initials. */
  src?: string | undefined;
  className?: string;
}

/** Initials on a sex-tinted tile (or a photo), the shared identity avatar. */
export function Avatar({ initials, tone = 'neutral', size = 'md', shape = 'rounded', src, className }: AvatarProps) {
  return (
    <span
      className={cx(
        styles['avatar'],
        styles[`avatar-${size}`],
        styles[`avatar-${shape}`],
        styles[`avatar-${tone}`],
        className,
      )}
      aria-hidden="true"
    >
      {src !== undefined ? <img src={src} alt="" loading="lazy" /> : initials}
    </span>
  );
}

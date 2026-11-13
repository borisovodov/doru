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
  className?: string;
}

/** Initials on a sex-tinted tile, the shared identity avatar of the app. */
export function Avatar({ initials, tone = 'neutral', size = 'md', shape = 'rounded', className }: AvatarProps) {
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
      {initials}
    </span>
  );
}

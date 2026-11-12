import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './IconButton.module.css';

export type IconButtonSize = 'sm' | 'md' | 'lg' | 'nav';
export type IconButtonVariant = 'ghost' | 'active' | 'primary' | 'danger';

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'aria-label' | 'children'> {
  /** Required accessible name; icon-only controls must never be unnamed. */
  label: string;
  icon: ReactNode;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
}

/**
 * An icon-only button. The accessible name is a required prop, so every
 * icon control has a role name for screen readers and role-based tests.
 */
export function IconButton({
  label,
  icon,
  size = 'md',
  variant = 'ghost',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={cx(styles['iconButton'], styles[size], styles[variant], className)}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}

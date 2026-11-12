import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

/**
 * The single button primitive. Variants cover the filled, quiet, destructive
 * and text-link roles; sizes map to the shared 24/28/32 control scale.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={cx(styles['button'], styles[variant], styles[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className={styles['spinner']} aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

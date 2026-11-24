import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { Tooltip, type TooltipPlacement } from '../tooltip/Tooltip';
import styles from './IconButton.module.css';

export type IconButtonSize = 'sm' | 'md' | 'lg' | 'nav';
export type IconButtonVariant = 'ghost' | 'active' | 'primary' | 'secondary' | 'danger';

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'aria-label' | 'children' | 'title'> {
  /** Required accessible name; also rendered as the tooltip text. */
  label: string;
  icon: ReactNode;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  /** Optional keyboard shortcut shown in the tooltip. */
  shortcut?: string | undefined;
  /** Preferred tooltip side; the tooltip flips when there is no room. */
  tooltipPlacement?: TooltipPlacement | undefined;
}

/**
 * An icon-only button. The accessible name is a required prop, so every
 * icon control has a role name for screen readers and role-based tests, and
 * the same text is always available as a hover/focus tooltip.
 */
export function IconButton({
  label,
  icon,
  size = 'md',
  variant = 'ghost',
  shortcut,
  tooltipPlacement,
  className,
  type = 'button',
  disabled,
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip label={label} shortcut={shortcut} placement={tooltipPlacement} disabled={disabled}>
      <button
        {...rest}
        type={type}
        className={cx(styles['iconButton'], styles[size], styles[variant], className)}
        aria-label={label}
        disabled={disabled}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

import type { ComponentPropsWithRef } from 'react';
import { cx } from '../../lib/cx';
import styles from './form.module.css';

export type ControlSize = 'sm' | 'md' | 'lg';

export interface InputProps extends ComponentPropsWithRef<'input'> {
  controlSize?: ControlSize;
  invalid?: boolean;
}

export function Input({ controlSize = 'md', invalid = false, className, ...rest }: InputProps) {
  return (
    <input
      {...rest}
      className={cx(styles['control'], styles[controlSize], invalid && styles['invalid'], className)}
      aria-invalid={invalid || undefined}
    />
  );
}

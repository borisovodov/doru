import type { ComponentPropsWithRef } from 'react';
import { cx } from '../../lib/cx';
import styles from './form.module.css';
import type { ControlSize } from './Input';

export interface SelectProps extends ComponentPropsWithRef<'select'> {
  controlSize?: ControlSize;
  invalid?: boolean;
}

export function Select({ controlSize = 'md', invalid = false, className, ...rest }: SelectProps) {
  return (
    <select
      {...rest}
      className={cx(styles['control'], styles[controlSize], invalid && styles['invalid'], className)}
      aria-invalid={invalid || undefined}
    />
  );
}

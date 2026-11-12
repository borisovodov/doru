import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './form.module.css';

export interface CheckboxProps extends Omit<ComponentPropsWithRef<'input'>, 'type'> {
  label: ReactNode;
}

/** A native checkbox with its label, the shared control-language focus ring. */
export function Checkbox({ label, className, ...rest }: CheckboxProps) {
  return (
    <label className={cx(styles['checkboxRow'], className)}>
      <input {...rest} type="checkbox" className={styles['checkbox']} />
      {label}
    </label>
  );
}

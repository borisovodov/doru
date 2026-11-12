import type { ComponentPropsWithRef } from 'react';
import { cx } from '../../lib/cx';
import styles from './form.module.css';
import type { ControlSize } from './Input';

export interface TextareaProps extends ComponentPropsWithRef<'textarea'> {
  controlSize?: ControlSize;
  invalid?: boolean;
}

export function Textarea({ controlSize = 'md', invalid = false, className, ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      className={cx(
        styles['control'],
        styles['textarea'],
        styles[controlSize],
        invalid && styles['invalid'],
        className,
      )}
      aria-invalid={invalid || undefined}
    />
  );
}

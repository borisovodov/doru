import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Field.module.css';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  /** A single form control; Field wires its id and aria descriptions. */
  children: ReactNode;
}

type ControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

/**
 * A labeled form field. The label is linked to the control automatically and
 * hint/error text is announced through aria-describedby.
 */
export function Field({ label, hint, error, required = false, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter((value): value is string => value !== undefined).join(' ') || undefined;

  let control = children;
  let controlId = id;
  if (isValidElement(children)) {
    const element = children as ReactElement<ControlProps>;
    controlId = element.props.id ?? id;
    // Field forwards the generated id and the aria attributes into the
    // caller's control while preserving its element type and own props.
    // oxlint-disable-next-line react/no-clone-element
    control = cloneElement(element, {
      id: controlId,
      ...(describedBy !== undefined ? { 'aria-describedby': describedBy } : {}),
      ...(error !== undefined ? { 'aria-invalid': true } : {}),
    });
  }

  return (
    <div className={cx(styles['field'], className)}>
      <label className={styles['label']} htmlFor={controlId}>
        {label}
        {required ? (
          <span className={styles['required']} aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {control}
      {hint ? (
        <p className={styles['hint']} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={styles['error']} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './SegmentedControl.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
  label: string;
  /** Lays the options out as a fixed-column grid instead of a single row. */
  columns?: number;
  className?: string;
}

/** A compact tab-style picker for a small, mutually exclusive set. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  columns,
  className,
}: SegmentedControlProps<T>) {
  const style = columns === undefined ? undefined : ({ '--segment-columns': columns } as CSSProperties);

  return (
    <div
      className={cx(styles['control'], columns !== undefined && styles['grid'], className)}
      style={style}
      role="tablist"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={cx(styles['segment'], option.value === value && styles['segmentActive'])}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

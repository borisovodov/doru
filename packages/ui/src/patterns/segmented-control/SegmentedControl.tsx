import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './SegmentedControl.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export type SegmentedControlMode = 'group' | 'tabs';

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
  label: string;
  /** Lays the options out as a fixed-column grid instead of a single row. */
  columns?: number;
  /** `group` is a toggle-button set; `tabs` uses the tablist keyboard model. */
  mode?: SegmentedControlMode;
  /** Base id for the tabs; used with `panelId` to connect tabs and their panel. */
  idPrefix?: string;
  /** Panel controlled by the active tab. */
  panelId?: string;
  className?: string;
}

/** A compact picker for a small, mutually exclusive set. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  columns,
  mode = 'group',
  idPrefix,
  panelId,
  className,
}: SegmentedControlProps<T>) {
  const fallbackId = useId();
  const tabPrefix = idPrefix ?? `segmented-${fallbackId}`;
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const isTabs = mode === 'tabs';

  const style = columns === undefined ? undefined : ({ '--segment-columns': columns } as CSSProperties);

  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );
  // While focus is inside the tablist, the focused tab is its single tab stop;
  // once focus leaves, the selected tab becomes the entry point again.
  const tabStop = focusedIndex !== null && focusedIndex < options.length ? focusedIndex : selectedIndex;

  const focusTab = (index: number): void => {
    const count = options.length;
    if (count === 0) {
      return;
    }
    buttonsRef.current[(index + count) % count]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    if (!isTabs) {
      return;
    }
    let next: number | undefined;
    switch (event.key) {
      case 'ArrowRight':
        next = index + 1;
        break;
      case 'ArrowLeft':
        next = index - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = options.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    focusTab(next);
  };

  return (
    <div
      className={cx(styles['control'], columns !== undefined && styles['grid'], className)}
      style={style}
      role={isTabs ? 'tablist' : 'group'}
      aria-label={label}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        const tabId = isTabs ? `${tabPrefix}-${option.value}` : undefined;
        return (
          <button
            key={option.value}
            ref={(element) => {
              buttonsRef.current[index] = element;
            }}
            type="button"
            id={tabId}
            role={isTabs ? 'tab' : undefined}
            aria-selected={isTabs ? active : undefined}
            aria-pressed={isTabs ? undefined : active}
            aria-controls={isTabs && panelId !== undefined ? panelId : undefined}
            tabIndex={isTabs ? (index === tabStop ? 0 : -1) : undefined}
            className={cx(styles['segment'], active && styles['segmentActive'])}
            onFocus={isTabs ? () => setFocusedIndex(index) : undefined}
            onBlur={isTabs ? () => setFocusedIndex(null) : undefined}
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

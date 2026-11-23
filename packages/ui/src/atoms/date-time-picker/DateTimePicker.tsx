import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react';
import { Broom, CalendarDays } from 'lucide-react';
import { cx } from '../../lib/cx';
import { inputToTimestamp, replaceInputDay } from '../../lib/datetime';
import { Button } from '../button/Button';
import { Calendar } from '../calendar/Calendar';
import { Input } from '../form/Input';
import { IconButton } from '../icon-button/IconButton';
import styles from './DateTimePicker.module.css';

function invalidateCloseFlush(): void {
  const window = globalThis.window as { doru?: { invalidateCloseFlush?: () => void } | undefined } | undefined;
  window?.doru?.invalidateCloseFlush?.();
}

export interface DateTimePickerLabels {
  /** Accessible name of the calendar trigger. */
  chooseDate: string;
  previousMonth: string;
  nextMonth: string;
  today: string;
  clear: string;
}

export interface DateTimePickerProps {
  /** A local `datetime-local` value; an empty string means "not set". */
  value: string;
  onChange: (value: string) => void;
  /** A BCP 47 locale used for the calendar. */
  locale: string;
  labels: DateTimePickerLabels;
  /**
   * Whether an empty value is allowed. Nullable fields show the inline clear
   * action when filled; a required field hides it and leaves validation to
   * the host form.
   */
  nullable?: boolean;
  id?: string;
  invalid?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  className?: string;
}

/**
 * A `datetime-local` input with a popover calendar. The calendar chooses the
 * day and keeps the time already typed in the input (09:00 for an empty
 * field); the input stays the source of truth for manual entry.
 */
export function DateTimePicker({
  value,
  onChange,
  locale,
  labels,
  nullable = true,
  id,
  invalid = false,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  const instant = inputToTimestamp(value);
  const selectedDay = instant !== undefined ? new Date(instant) : undefined;

  const select = (day: Date) => {
    invalidateCloseFlush();
    onChange(replaceInputDay(value, day));
    close();
  };

  const selectToday = () => {
    invalidateCloseFlush();
    onChange(replaceInputDay(value, new Date()));
    close();
  };

  const clear = () => {
    invalidateCloseFlush();
    onChange('');
    close();
  };

  const onRootBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    // Keyboard focus moved out of the composite picker; close without
    // pulling focus back from the field that received it.
    setOpen(false);
  };

  return (
    <div className={cx(styles['root'], className)} ref={rootRef} data-autosave-field="true" onBlur={onRootBlur}>
      <Input
        id={id}
        className={styles['input']}
        type="datetime-local"
        value={value}
        invalid={invalid || ariaInvalid === true}
        aria-describedby={describedBy}
        onChange={(event) => {
          onChange(event.target.value);
          // Manual entry can move the date to another month; close the
          // calendar instead of leaving it on a stale month.
          if (open) {
            setOpen(false);
          }
        }}
      />
      <IconButton
        ref={triggerRef}
        className={styles['trigger']}
        size="md"
        variant={open ? 'active' : 'ghost'}
        label={labels.chooseDate}
        icon={<CalendarDays size={15} aria-hidden="true" />}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      />
      {nullable && value !== '' && (
        <IconButton
          className={styles['trigger']}
          size="md"
          label={labels.clear}
          icon={<Broom size={15} aria-hidden="true" />}
          onClick={clear}
        />
      )}
      {open && (
        <div className={styles['popover']} role="dialog" aria-label={labels.chooseDate}>
          <Calendar
            value={selectedDay}
            locale={locale}
            previousMonthLabel={labels.previousMonth}
            nextMonthLabel={labels.nextMonth}
            onSelect={select}
          />
          <div className={styles['footer']}>
            <Button variant="ghost" size="sm" onClick={selectToday}>
              {labels.today}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

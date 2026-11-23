import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '../../lib/cx';
import {
  addLocalDays,
  addLocalMonths,
  daysInMonth,
  localDay,
  localDayKey,
  monthGrid,
  sameLocalDay,
  systemFirstDayOfWeek,
  weekdayNames,
} from '../../lib/datetime';
import { IconButton } from '../icon-button/IconButton';
import styles from './Calendar.module.css';

export interface CalendarProps {
  /** The selected day; the visible month follows it on first render. */
  value?: Date | undefined;
  /**
   * A BCP 47 locale used for the month and weekday names. The first day of
   * the week follows the operating system's regional settings.
   */
  locale: string;
  previousMonthLabel: string;
  nextMonthLabel: string;
  /** Called with the chosen day (local noon). */
  onSelect: (day: Date) => void;
  className?: string;
}

/**
 * A month calendar with a roving keyboard focus: arrows move by day or week,
 * Home/End by week, PageUp/PageDown by month, Enter/Space selects. Every day
 * button carries its full localized date as the accessible name.
 */
export function Calendar({ value, locale, previousMonthLabel, nextMonthLabel, onSelect, className }: CalendarProps) {
  const [visible, setVisible] = useState(() => {
    const initial = value ?? new Date();
    return { year: initial.getFullYear(), month: initial.getMonth() };
  });
  const [focusedDay, setFocusedDay] = useState<Date>(() => value ?? new Date());
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusRequested = useRef(false);
  const initialFocusDone = useRef(false);

  const firstDay = useMemo(() => systemFirstDayOfWeek(locale), [locale]);
  const weekdays = useMemo(() => weekdayNames(locale, firstDay), [locale, firstDay]);
  const days = useMemo(() => monthGrid(visible.year, visible.month, firstDay), [visible, firstDay]);
  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
        localDay(visible.year, visible.month, 1),
      ),
    [locale, visible],
  );
  const fullDayLabel = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'full' }), [locale]);
  const [today] = useState(() => new Date());
  const focusedKey = localDayKey(focusedDay);

  useEffect(() => {
    if (initialFocusDone.current) {
      return;
    }
    initialFocusDone.current = true;
    cellRefs.current.get(focusedKey)?.focus({ preventScroll: true });
  });

  useEffect(() => {
    if (!focusRequested.current) {
      return;
    }
    focusRequested.current = false;
    cellRefs.current.get(focusedKey)?.focus({ preventScroll: true });
  }, [focusedKey, visible]);

  const moveFocus = (day: Date) => {
    focusRequested.current = true;
    setFocusedDay(day);
    setVisible({ year: day.getFullYear(), month: day.getMonth() });
  };

  const changeMonth = (amount: number) => {
    const next = addLocalMonths(localDay(visible.year, visible.month, 1), amount);
    setVisible({ year: next.getFullYear(), month: next.getMonth() });
    setFocusedDay(
      localDay(
        next.getFullYear(),
        next.getMonth(),
        Math.min(focusedDay.getDate(), daysInMonth(next.getFullYear(), next.getMonth())),
      ),
    );
  };

  const onGridKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    let next: Date | undefined;
    switch (event.key) {
      case 'ArrowLeft':
        next = addLocalDays(focusedDay, -1);
        break;
      case 'ArrowRight':
        next = addLocalDays(focusedDay, 1);
        break;
      case 'ArrowUp':
        next = addLocalDays(focusedDay, -7);
        break;
      case 'ArrowDown':
        next = addLocalDays(focusedDay, 7);
        break;
      case 'Home': {
        const offset = (focusedDay.getDay() - (firstDay % 7) + 7) % 7;
        next = addLocalDays(focusedDay, -offset);
        break;
      }
      case 'End': {
        const offset = (focusedDay.getDay() - (firstDay % 7) + 7) % 7;
        next = addLocalDays(focusedDay, 6 - offset);
        break;
      }
      case 'PageUp':
        next = addLocalMonths(focusedDay, -1);
        break;
      case 'PageDown':
        next = addLocalMonths(focusedDay, 1);
        break;
      default:
        return;
    }
    event.preventDefault();
    moveFocus(next);
  };

  return (
    <div className={cx(styles['calendar'], className)}>
      <div className={styles['header']}>
        <IconButton
          size="sm"
          label={previousMonthLabel}
          icon={<ChevronLeft size={14} aria-hidden="true" />}
          onClick={() => changeMonth(-1)}
        />
        <div className={styles['month']} aria-live="polite">
          {monthLabel}
        </div>
        <IconButton
          size="sm"
          label={nextMonthLabel}
          icon={<ChevronRight size={14} aria-hidden="true" />}
          onClick={() => changeMonth(1)}
        />
      </div>
      <table className={styles['grid']} aria-label={monthLabel} onKeyDown={onGridKeyDown}>
        <thead>
          <tr>
            {weekdays.map((weekday) => (
              <th key={weekday} scope="col" className={styles['weekday']}>
                {weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4, 5].map((week) => (
            <tr key={week}>
              {days.slice(week * 7, week * 7 + 7).map((day) => {
                const key = localDayKey(day);
                const selected = value !== undefined && sameLocalDay(day, value);
                const isToday = sameLocalDay(day, today);
                const outside = day.getMonth() !== visible.month;
                return (
                  <td key={key}>
                    <button
                      ref={(node) => {
                        if (node) {
                          cellRefs.current.set(key, node);
                        } else {
                          cellRefs.current.delete(key);
                        }
                      }}
                      type="button"
                      className={cx(
                        styles['day'],
                        outside && styles['outside'],
                        selected && styles['selected'],
                        isToday && styles['today'],
                      )}
                      tabIndex={key === focusedKey ? 0 : -1}
                      aria-label={fullDayLabel.format(day)}
                      aria-pressed={selected}
                      aria-current={isToday ? 'date' : undefined}
                      onClick={() => onSelect(day)}
                      onFocus={() => setFocusedDay(day)}
                    >
                      {day.getDate()}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

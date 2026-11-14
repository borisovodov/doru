import type { DateQuality } from '@doru/core';
import { nls } from '../../nls';
import { Checkbox } from '../../atoms/form/Checkbox';
import { Input } from '../../atoms/form/Input';
import { Select } from '../../atoms/form/Select';
import type { DateDraft } from '../person/draft';
import styles from './DateEditor.module.css';

/** The calendars the editor can pick; '' is Gregorian. */
const CALENDARS = ['', 'julian', 'french_republican', 'hebrew'] as const;

export function DateEditor({
  label,
  value,
  onChange,
  hidePlace = false,
}: {
  label: string;
  value: DateDraft;
  onChange: (value: DateDraft) => void;
  /** Hides the place input — for dates where only the date itself is meaningful (sort dates). */
  hidePlace?: boolean;
}) {
  const set = (patch: Partial<DateDraft>) => onChange({ ...value, ...patch });

  return (
    <div className={styles['dateEditor']}>
      {label !== '' && <label className={styles['label']}>{label}</label>}
      <div className={styles['row']}>
        <Input
          controlSize="sm"
          type="number"
          aria-label={nls.t('features.tree.date.yearPlaceholder')}
          placeholder={nls.t('features.tree.date.yearPlaceholder')}
          value={value.year}
          onChange={(event) => set({ year: event.target.value })}
        />
        {value.calendar === '' || value.calendar === 'julian' ? (
          <Input
            controlSize="sm"
            type="number"
            aria-label={nls.t('features.tree.date.monthPlaceholder')}
            placeholder={nls.t('features.tree.date.monthPlaceholder')}
            min={1}
            max={12}
            value={value.month}
            onChange={(event) => set({ month: event.target.value })}
          />
        ) : (
          <Input
            controlSize="sm"
            aria-label={nls.t('features.tree.date.monthCodePlaceholder')}
            placeholder={nls.t('features.tree.date.monthCodePlaceholder')}
            value={value.month}
            onChange={(event) => set({ month: event.target.value })}
          />
        )}
        <Input
          controlSize="sm"
          type="number"
          aria-label={nls.t('features.tree.date.dayPlaceholder')}
          placeholder={nls.t('features.tree.date.dayPlaceholder')}
          min={1}
          max={31}
          value={value.day}
          onChange={(event) => set({ day: event.target.value })}
        />
        <Select
          controlSize="sm"
          aria-label={nls.t('features.tree.date.quality')}
          value={value.quality}
          onChange={(event) => set({ quality: event.target.value as DateQuality })}
        >
          <option value="exact">{nls.t('features.tree.date.exact')}</option>
          <option value="about">{nls.t('features.tree.date.about')}</option>
          <option value="before">{nls.t('features.tree.date.before')}</option>
          <option value="after">{nls.t('features.tree.date.after')}</option>
          <option value="range">{nls.t('features.tree.date.range')}</option>
          <option value="unknown">{nls.t('features.tree.date.unknown')}</option>
        </Select>
        {!hidePlace && (
          <Input
            controlSize="sm"
            aria-label={nls.t('features.tree.field.place')}
            placeholder={nls.t('features.tree.field.place')}
            value={value.place}
            onChange={(event) => set({ place: event.target.value })}
          />
        )}
      </div>
      {value.quality === 'about' && (
        <div className={styles['row']}>
          <span className={styles['rangeLabel']}>{nls.t('features.tree.date.modifier')}</span>
          <Select
            controlSize="sm"
            aria-label={nls.t('features.tree.date.modifier')}
            value={value.modifier}
            onChange={(event) => set({ modifier: event.target.value })}
          >
            <option value="">{nls.t('features.tree.date.modifier.none')}</option>
            <option value="ABT">{nls.t('features.tree.date.modifier.ABT')}</option>
            <option value="CAL">{nls.t('features.tree.date.modifier.CAL')}</option>
            <option value="EST">{nls.t('features.tree.date.modifier.EST')}</option>
          </Select>
        </div>
      )}
      {value.quality === 'range' && (
        <div className={styles['row']}>
          <span className={styles['rangeLabel']}>{nls.t('features.tree.date.end')}</span>
          <Input
            controlSize="sm"
            type="number"
            aria-label={nls.t('features.tree.date.yearPlaceholder')}
            placeholder={nls.t('features.tree.date.yearPlaceholder')}
            value={value.endYear}
            onChange={(event) => set({ endYear: event.target.value })}
          />
          {value.endCalendar === '' || value.endCalendar === 'julian' ? (
            <Input
              controlSize="sm"
              type="number"
              aria-label={nls.t('features.tree.date.monthPlaceholder')}
              placeholder={nls.t('features.tree.date.monthPlaceholder')}
              min={1}
              max={12}
              value={value.endMonth}
              onChange={(event) => set({ endMonth: event.target.value })}
            />
          ) : (
            <Input
              controlSize="sm"
              aria-label={nls.t('features.tree.date.monthCodePlaceholder')}
              placeholder={nls.t('features.tree.date.monthCodePlaceholder')}
              value={value.endMonth}
              onChange={(event) => set({ endMonth: event.target.value })}
            />
          )}
          <Input
            controlSize="sm"
            type="number"
            aria-label={nls.t('features.tree.date.dayPlaceholder')}
            placeholder={nls.t('features.tree.date.dayPlaceholder')}
            min={1}
            max={31}
            value={value.endDay}
            onChange={(event) => set({ endDay: event.target.value })}
          />
        </div>
      )}
      <div className={styles['row']}>
        <span className={styles['rangeLabel']}>{nls.t('features.tree.date.calendar')}</span>
        <Select
          controlSize="sm"
          aria-label={nls.t('features.tree.date.calendar')}
          value={value.calendar}
          onChange={(event) => set({ calendar: event.target.value })}
        >
          {CALENDARS.map((calendar) => (
            <option key={calendar} value={calendar}>
              {nls.t(
                calendar === '' ? 'features.tree.date.calendar.gregorian' : `features.tree.date.calendar.${calendar}`,
              )}
            </option>
          ))}
        </Select>
        <Checkbox
          label={nls.t('features.tree.date.bce')}
          checked={value.epoch === 'BCE'}
          onChange={(event) => set({ epoch: event.target.checked ? 'BCE' : '' })}
        />
        {value.quality === 'range' && (
          <>
            <span className={styles['rangeLabel']}>{nls.t('features.tree.date.endCalendar')}</span>
            <Select
              controlSize="sm"
              aria-label={nls.t('features.tree.date.endCalendar')}
              value={value.endCalendar}
              onChange={(event) => set({ endCalendar: event.target.value })}
            >
              {CALENDARS.map((calendar) => (
                <option key={calendar} value={calendar}>
                  {nls.t(
                    calendar === ''
                      ? 'features.tree.date.calendar.gregorian'
                      : `features.tree.date.calendar.${calendar}`,
                  )}
                </option>
              ))}
            </Select>
            <Checkbox
              label={nls.t('features.tree.date.bce')}
              checked={value.endEpoch === 'BCE'}
              onChange={(event) => set({ endEpoch: event.target.checked ? 'BCE' : '' })}
            />
          </>
        )}
      </div>
      <div className={styles['row']}>
        <span className={styles['rangeLabel']}>{nls.t('features.tree.date.time')}</span>
        <Input
          controlSize="sm"
          type="number"
          min={0}
          max={23}
          aria-label={nls.t('features.tree.date.timeHour')}
          placeholder={nls.t('features.tree.date.timeHour')}
          value={value.timeHour}
          onChange={(event) => set({ timeHour: event.target.value })}
        />
        <Input
          controlSize="sm"
          type="number"
          min={0}
          max={59}
          aria-label={nls.t('features.tree.date.timeMinute')}
          placeholder={nls.t('features.tree.date.timeMinute')}
          value={value.timeMinute}
          onChange={(event) => set({ timeMinute: event.target.value })}
        />
        <Input
          controlSize="sm"
          type="number"
          min={0}
          max={59}
          aria-label={nls.t('features.tree.date.timeSecond')}
          placeholder={nls.t('features.tree.date.timeSecond')}
          value={value.timeSecond}
          onChange={(event) => set({ timeSecond: event.target.value })}
        />
        <Input
          controlSize="sm"
          aria-label={nls.t('features.tree.date.timeFraction')}
          placeholder={nls.t('features.tree.date.timeFraction')}
          value={value.timeFraction}
          onChange={(event) => set({ timeFraction: event.target.value })}
        />
        <Checkbox
          label={nls.t('features.tree.date.timeUtc')}
          checked={value.timeUtc}
          onChange={(event) => set({ timeUtc: event.target.checked })}
        />
      </div>
      <div className={styles['row']}>
        <Input
          controlSize="sm"
          className={styles['textInput']}
          aria-label={nls.t('features.tree.field.dateText')}
          placeholder={nls.t('features.tree.field.dateText')}
          value={value.text}
          onChange={(event) => set({ text: event.target.value })}
        />
      </div>
    </div>
  );
}

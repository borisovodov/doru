import type { DateQuality } from '@doru/core';
import { nls } from '../nls';
import type { DateDraft } from './draft';

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
    <div className="date-editor">
      {label !== '' && <label>{label}</label>}
      <div className="date-editor-row">
        <input
          type="number"
          placeholder={nls.t('features.tree.date.yearPlaceholder')}
          value={value.year}
          onChange={(event) => set({ year: event.target.value })}
        />
        {value.calendar === '' || value.calendar === 'julian' ? (
          <input
            type="number"
            placeholder={nls.t('features.tree.date.monthPlaceholder')}
            min={1}
            max={12}
            value={value.month}
            onChange={(event) => set({ month: event.target.value })}
          />
        ) : (
          <input
            placeholder={nls.t('features.tree.date.monthCodePlaceholder')}
            value={value.month}
            onChange={(event) => set({ month: event.target.value })}
          />
        )}
        <input
          type="number"
          placeholder={nls.t('features.tree.date.dayPlaceholder')}
          min={1}
          max={31}
          value={value.day}
          onChange={(event) => set({ day: event.target.value })}
        />
        <select value={value.quality} onChange={(event) => set({ quality: event.target.value as DateQuality })}>
          <option value="exact">{nls.t('features.tree.date.exact')}</option>
          <option value="about">{nls.t('features.tree.date.about')}</option>
          <option value="before">{nls.t('features.tree.date.before')}</option>
          <option value="after">{nls.t('features.tree.date.after')}</option>
          <option value="range">{nls.t('features.tree.date.range')}</option>
          <option value="unknown">{nls.t('features.tree.date.unknown')}</option>
        </select>
        {!hidePlace && (
          <input
            placeholder={nls.t('features.tree.field.place')}
            value={value.place}
            onChange={(event) => set({ place: event.target.value })}
          />
        )}
      </div>
      {value.quality === 'about' && (
        <div className="date-editor-row">
          <span className="date-editor-range-label">{nls.t('features.tree.date.modifier')}</span>
          <select value={value.modifier} onChange={(event) => set({ modifier: event.target.value })}>
            <option value="">{nls.t('features.tree.date.modifier.none')}</option>
            <option value="ABT">{nls.t('features.tree.date.modifier.ABT')}</option>
            <option value="CAL">{nls.t('features.tree.date.modifier.CAL')}</option>
            <option value="EST">{nls.t('features.tree.date.modifier.EST')}</option>
          </select>
        </div>
      )}
      {value.quality === 'range' && (
        <div className="date-editor-row">
          <span className="date-editor-range-label">{nls.t('features.tree.date.end')}</span>
          <input
            type="number"
            placeholder={nls.t('features.tree.date.yearPlaceholder')}
            value={value.endYear}
            onChange={(event) => set({ endYear: event.target.value })}
          />
          {value.endCalendar === '' || value.endCalendar === 'julian' ? (
            <input
              type="number"
              placeholder={nls.t('features.tree.date.monthPlaceholder')}
              min={1}
              max={12}
              value={value.endMonth}
              onChange={(event) => set({ endMonth: event.target.value })}
            />
          ) : (
            <input
              placeholder={nls.t('features.tree.date.monthCodePlaceholder')}
              value={value.endMonth}
              onChange={(event) => set({ endMonth: event.target.value })}
            />
          )}
          <input
            type="number"
            placeholder={nls.t('features.tree.date.dayPlaceholder')}
            min={1}
            max={31}
            value={value.endDay}
            onChange={(event) => set({ endDay: event.target.value })}
          />
        </div>
      )}
      <div className="date-editor-row">
        <span className="date-editor-range-label">{nls.t('features.tree.date.calendar')}</span>
        <select value={value.calendar} onChange={(event) => set({ calendar: event.target.value })}>
          {CALENDARS.map((calendar) => (
            <option key={calendar} value={calendar}>
              {nls.t(
                calendar === ''
                  ? 'features.tree.date.calendar.gregorian'
                  : `features.tree.date.calendar.${calendar}`,
              )}
            </option>
          ))}
        </select>
        <label className="date-epoch-check">
          <input
            type="checkbox"
            checked={value.epoch === 'BCE'}
            onChange={(event) => set({ epoch: event.target.checked ? 'BCE' : '' })}
          />
          {nls.t('features.tree.date.bce')}
        </label>
        {value.quality === 'range' && (
          <>
            <span className="date-editor-range-label">{nls.t('features.tree.date.endCalendar')}</span>
            <select value={value.endCalendar} onChange={(event) => set({ endCalendar: event.target.value })}>
              {CALENDARS.map((calendar) => (
                <option key={calendar} value={calendar}>
                  {nls.t(
                    calendar === ''
                      ? 'features.tree.date.calendar.gregorian'
                      : `features.tree.date.calendar.${calendar}`,
                  )}
                </option>
              ))}
            </select>
            <label className="date-epoch-check">
              <input
                type="checkbox"
                checked={value.endEpoch === 'BCE'}
                onChange={(event) => set({ endEpoch: event.target.checked ? 'BCE' : '' })}
              />
              {nls.t('features.tree.date.bce')}
            </label>
          </>
        )}
      </div>
      <div className="date-editor-row">
        <span className="date-editor-range-label">{nls.t('features.tree.date.time')}</span>
        <input
          type="number"
          min={0}
          max={23}
          placeholder={nls.t('features.tree.date.timeHour')}
          value={value.timeHour}
          onChange={(event) => set({ timeHour: event.target.value })}
        />
        <input
          type="number"
          min={0}
          max={59}
          placeholder={nls.t('features.tree.date.timeMinute')}
          value={value.timeMinute}
          onChange={(event) => set({ timeMinute: event.target.value })}
        />
        <input
          type="number"
          min={0}
          max={59}
          placeholder={nls.t('features.tree.date.timeSecond')}
          value={value.timeSecond}
          onChange={(event) => set({ timeSecond: event.target.value })}
        />
        <label className="date-epoch-check">
          <input
            type="checkbox"
            checked={value.timeUtc}
            onChange={(event) => set({ timeUtc: event.target.checked })}
          />
          {nls.t('features.tree.date.timeUtc')}
        </label>
      </div>
      <div className="date-editor-row">
        <input
          className="date-text-input"
          placeholder={nls.t('features.tree.field.dateText')}
          value={value.text}
          onChange={(event) => set({ text: event.target.value })}
        />
      </div>
    </div>
  );
}

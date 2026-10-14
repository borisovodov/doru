import type { DateQuality } from '@doru/core';
import { nls } from '../nls';
import type { DateDraft } from './draft';

export function DateEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DateDraft;
  onChange: (value: DateDraft) => void;
}) {
  const set = (patch: Partial<DateDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="date-editor">
      <label>{label}</label>
      <div className="date-editor-row">
        <input
          type="number"
          placeholder="YYYY"
          value={value.year}
          onChange={(event) => set({ year: event.target.value })}
        />
        <input
          type="number"
          placeholder="MM"
          min={1}
          max={12}
          value={value.month}
          onChange={(event) => set({ month: event.target.value })}
        />
        <input
          type="number"
          placeholder="DD"
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
          <option value="unknown">{nls.t('features.tree.date.unknown')}</option>
        </select>
        <input
          placeholder={nls.t('features.tree.field.place')}
          value={value.place}
          onChange={(event) => set({ place: event.target.value })}
        />
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

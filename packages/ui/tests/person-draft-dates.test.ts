import { describe, expect, it } from 'vitest';
import type { DateDraft, NameDraft, PersonDraft } from '../src/domain/person/draft';
import {
  addNamePart,
  rebaseDate,
  dateDraftBlank,
  draftInitials,
  draftSpan,
  emptyDate,
  emptyNameDraft,
  fromDateDraft,
  nameDraftDisplay,
  nameDraftEmpty,
  newPersonDraft,
  partOf,
  removeNamePart,
  setPartValue,
  toDateDraft,
} from '../src/domain/person/draft';
import type { NamePart } from '@doru/core';

const part = (kind: NamePart['kind'], value: string, id = `${kind}-${value}`): NamePart => ({
  id,
  kind,
  value,
  position: 0,
});

const nameDraft = (overrides: Partial<NameDraft> = {}): NameDraft => ({
  ...emptyNameDraft(),
  parts: [part('given', 'Ivan'), part('surname', 'Petrov')],
  ...overrides,
});

const draft = (overrides: Partial<PersonDraft> = {}): PersonDraft => ({
  id: 'P1',
  names: [nameDraft()],
  sex: 'U',
  birth: emptyDate(),
  death: emptyDate(),
  isNew: false,
  ...overrides,
});

const dateDraft = (overrides: Partial<DateDraft> = {}): DateDraft => ({ ...emptyDate(), ...overrides });

describe('emptyDate', () => {
  it('starts with every field empty and exact quality', () => {
    expect(emptyDate()).toEqual({
      year: '',
      month: '',
      day: '',
      endYear: '',
      endMonth: '',
      endDay: '',
      text: '',
      quality: 'exact',
      place: '',
      modifier: '',
      calendar: '',
      epoch: '',
      endCalendar: '',
      endEpoch: '',
      timeHour: '',
      timeMinute: '',
      timeSecond: '',
      timeFraction: '',
      timeUtc: false,
    });
  });
});

describe('dateDraftBlank', () => {
  it('treats the empty draft as blank', () => {
    expect(dateDraftBlank(emptyDate())).toBe(true);
  });

  it('keeps a draft with a date component', () => {
    expect(dateDraftBlank(dateDraft({ year: '1923' }))).toBe(false);
  });

  it('keeps BCE, calendar, modifier and time flags', () => {
    expect(dateDraftBlank(dateDraft({ epoch: 'BCE' }))).toBe(false);
    expect(dateDraftBlank(dateDraft({ endEpoch: 'BCE' }))).toBe(false);
    expect(dateDraftBlank(dateDraft({ calendar: 'julian' }))).toBe(false);
    expect(dateDraftBlank(dateDraft({ endCalendar: 'hebrew' }))).toBe(false);
    expect(dateDraftBlank(dateDraft({ modifier: 'ABT' }))).toBe(false);
    expect(dateDraftBlank(dateDraft({ timeUtc: true }))).toBe(false);
    expect(dateDraftBlank(dateDraft({ timeHour: '12' }))).toBe(false);
  });
});

describe('partOf / setPartValue', () => {
  it('reads the first part of a kind', () => {
    expect(partOf(nameDraft(), 'given')).toBe('Ivan');
    expect(partOf(nameDraft(), 'suffix')).toBe('');
  });

  it('updates only the first part of the kind and keeps the rest', () => {
    const withTwoGiven = nameDraft({
      parts: [part('given', 'Anna', 'G1'), part('given', 'Maria', 'G2'), part('surname', 'Schmidt')],
    });
    const updated = setPartValue(withTwoGiven, 'given', 'Anna Maria');
    expect(updated.parts).toEqual([
      { id: 'G1', kind: 'given', value: 'Anna Maria', position: 0 },
      part('given', 'Maria', 'G2'),
      part('surname', 'Schmidt'),
    ]);
  });

  it('adds a part of the same kind and removes it by id', () => {
    const withExtra = addNamePart(nameDraft(), 'given', 'Maria');
    expect(withExtra.parts.filter((entry) => entry.kind === 'given')).toHaveLength(2);
    const extra = withExtra.parts.find((entry) => entry.value === 'Maria')!;
    const removed = removeNamePart(withExtra, extra.id);
    expect(removed.parts).toEqual(nameDraft().parts);
  });

  it('drops the kind when the value is emptied', () => {
    const updated = setPartValue(nameDraft(), 'given', '  ');
    expect(updated.parts).toEqual([part('surname', 'Petrov')]);
  });

  it('assigns a fresh id when the kind had no part', () => {
    const updated = setPartValue(nameDraft(), 'suffix', 'Jr.');
    expect(updated.parts[2]).toMatchObject({ kind: 'suffix', value: 'Jr.' });
    expect(updated.parts[2]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('nameDraftDisplay', () => {
  it('is empty for a missing name', () => {
    expect(nameDraftDisplay(undefined)).toBe('');
  });

  it('prefers the verbatim display form, stripping GEDCOM slashes', () => {
    expect(nameDraftDisplay(nameDraft({ parts: [part('full', '/Ivan Petrov/'), part('given', 'Ivan')] }))).toBe(
      'Ivan Petrov',
    );
  });

  it('falls back to given + surname', () => {
    expect(nameDraftDisplay(nameDraft())).toBe('Ivan Petrov');
    expect(nameDraftDisplay(nameDraft({ parts: [part('given', 'Ivan')] }))).toBe('Ivan');
    expect(nameDraftDisplay(nameDraft({ parts: [] }))).toBe('');
  });
});

describe('draftInitials', () => {
  it('returns "?" when there are no names', () => {
    expect(draftInitials(draft({ names: [] }))).toBe('?');
  });

  it('derives initials from given and surname', () => {
    expect(draftInitials(draft())).toBe('IP');
  });

  it('derives initials from the first two words of the verbatim form', () => {
    expect(draftInitials(draft({ names: [nameDraft({ parts: [part('full', 'Anna Maria Ivanova')] })] }))).toBe('AM');
  });

  it('works with a single part', () => {
    expect(draftInitials(draft({ names: [nameDraft({ parts: [part('given', 'Ivan')] })] }))).toBe('I');
    expect(draftInitials(draft({ names: [nameDraft({ parts: [part('surname', 'Petrov')] })] }))).toBe('P');
  });

  it('ignores whitespace-only parts', () => {
    expect(
      draftInitials(draft({ names: [nameDraft({ parts: [part('given', '   '), part('surname', 'Petrov')] })] })),
    ).toBe('P');
  });

  it('prefers the primary name', () => {
    expect(
      draftInitials(
        draft({
          names: [
            nameDraft({ id: 'N1', parts: [part('given', 'Maria'), part('surname', 'Sidorova')] }),
            nameDraft({ id: 'N2', primary: true, parts: [part('given', 'Maria'), part('surname', 'Ivanova')] }),
          ],
        }),
      ),
    ).toBe('MI');
  });
});

describe('draftSpan', () => {
  const withBirth = (birth: DateDraft): PersonDraft => draft({ birth });

  it('is empty when both dates are empty', () => {
    expect(draftSpan(draft())).toBe('');
  });

  it('shows one side only', () => {
    expect(draftSpan(withBirth(dateDraft({ year: '1923' })))).toBe('1923');
  });

  it('appends the age when both years are plain', () => {
    const span = draftSpan(draft({ birth: dateDraft({ year: '1923' }), death: dateDraft({ year: '1990' }) }));
    expect(span).toBe('1923 – 1990 (67)');
  });

  it('skips the age for negative or implausible spans', () => {
    expect(draftSpan(draft({ birth: dateDraft({ year: '1990' }), death: dateDraft({ year: '1923' }) }))).toBe(
      '1990 – 1923',
    );
    expect(draftSpan(draft({ birth: dateDraft({ year: '1800' }), death: dateDraft({ year: '1990' }) }))).toBe(
      '1800 – 1990',
    );
  });

  it('appends the age for approximate dates but not for text dates', () => {
    expect(
      draftSpan(draft({ birth: dateDraft({ year: '1923', quality: 'about' }), death: dateDraft({ year: '1990' }) })),
    ).toBe('~1923 – 1990 (67)');
    expect(
      draftSpan(draft({ birth: dateDraft({ year: '1923' }), death: dateDraft({ year: '1990', text: 'summer' }) })),
    ).toBe('1923 – 1990 summer');
  });
});

describe('newPersonDraft', () => {
  it('builds an empty new-person draft with a fresh id and one empty name', () => {
    const created = newPersonDraft();
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created).toMatchObject({ sex: 'U', isNew: true });
    expect(created.names).toHaveLength(1);
    expect(created.names[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(nameDraftEmpty(created.names[0]!)).toBe(true);
  });
});

describe('date refinements', () => {
  it('round-trips the modifier, calendar, era and time', () => {
    const date = toDateDraft({
      quality: 'about',
      modifier: 'EST',
      component: { calendar: 'hebrew', year: 5780, epoch: 'BCE' },
      time: { hour: 9, minute: 30, second: 5, utc: true },
    });
    expect(date.modifier).toBe('EST');
    expect(date.calendar).toBe('hebrew');
    expect(date.epoch).toBe('BCE');
    expect(date.timeHour).toBe('9');
    expect(fromDateDraft(date)).toEqual({
      quality: 'about',
      modifier: 'EST',
      component: { calendar: 'hebrew', year: 5780, epoch: 'BCE' },
      time: { hour: 9, minute: 30, second: 5, utc: true },
    });
  });

  it('keeps non-Gregorian month codes through the round trip', () => {
    const date = toDateDraft({
      quality: 'exact',
      component: { calendar: 'french_republican', year: 12, month: 'VEND' },
    });
    expect(date.month).toBe('VEND');
    expect(fromDateDraft(date)?.component).toEqual({ calendar: 'french_republican', year: 12, month: 'VEND' });
  });

  it('defaults missing time parts to zero and keeps the UTC flag', () => {
    expect(fromDateDraft(dateDraft({ timeHour: '9' }))?.time).toEqual({ hour: 9, minute: 0 });
    expect(fromDateDraft(dateDraft({ timeHour: '9', timeMinute: '5', timeUtc: true }))?.time).toEqual({
      hour: 9,
      minute: 5,
      utc: true,
    });
  });

  it('writes a time-only date without a component', () => {
    expect(fromDateDraft(dateDraft({ timeHour: '9', timeMinute: '30' }))).toEqual({
      quality: 'exact',
      time: { hour: 9, minute: 30 },
    });
  });

  it('carries the modifier for every non-range date', () => {
    expect(fromDateDraft(dateDraft({ quality: 'about', year: '1900', modifier: 'CAL' }))).toEqual({
      quality: 'about',
      modifier: 'CAL',
      component: { year: 1900 },
    });
    expect(fromDateDraft(dateDraft({ quality: 'exact', year: '1900', modifier: 'CAL' }))).toEqual({
      quality: 'exact',
      modifier: 'CAL',
      component: { year: 1900 },
    });
    expect(fromDateDraft(dateDraft({ quality: 'range', year: '1900', endYear: '1910', modifier: 'CAL' }))).toEqual({
      quality: 'range',
      modifier: 'CAL',
      component: { year: 1900 },
      end: { year: 1910 },
    });
  });

  it('writes the fractional seconds from the draft', () => {
    expect(fromDateDraft(dateDraft({ timeHour: '9', timeMinute: '0', timeFraction: '5' }))?.time).toEqual({
      hour: 9,
      minute: 0,
      fraction: '5',
    });
  });

  it('carries the date row id through rebaseDate and keeps the draft time verbatim', () => {
    const stored = {
      id: 'D1',
      quality: 'exact' as const,
      component: { year: 1900 },
      time: { hour: 12, minute: 0, fraction: '5' },
    };
    const next = { quality: 'exact' as const, component: { year: 1901 }, time: { hour: 9, minute: 0 } };
    expect(rebaseDate(next, stored)).toEqual({
      id: 'D1',
      quality: 'exact',
      component: { year: 1901 },
      time: { hour: 9, minute: 0 },
    });
  });

  it('returns the next date when nothing is stored', () => {
    const next = { quality: 'exact' as const, component: { year: 1901 } };
    expect(rebaseDate(next, undefined)).toBe(next);
    expect(rebaseDate(undefined, { quality: 'exact', component: { year: 1900 } })).toBeUndefined();
  });
});

describe('toDateDraft', () => {
  it('turns undefined into an empty draft', () => {
    expect(toDateDraft(undefined)).toEqual(emptyDate());
    expect(toDateDraft(undefined, 'Moscow')).toEqual({ ...emptyDate(), place: 'Moscow' });
  });

  it('copies every date field', () => {
    expect(
      toDateDraft({
        quality: 'range',
        component: { year: 1920, month: 3, day: 4 },
        end: { year: 1930, month: 5, day: 6 },
        text: 'winter',
      }),
    ).toEqual({
      ...emptyDate(),
      year: '1920',
      month: '3',
      day: '4',
      endYear: '1930',
      endMonth: '5',
      endDay: '6',
      text: 'winter',
      quality: 'range',
    });
  });
});

describe('fromDateDraft', () => {
  it('returns undefined for an empty draft', () => {
    expect(fromDateDraft(emptyDate())).toBeUndefined();
    expect(fromDateDraft(dateDraft({ text: '   ' }))).toBeUndefined();
  });

  it('parses the component fields', () => {
    expect(fromDateDraft(dateDraft({ year: '1923', month: '6', day: '1' }))).toEqual({
      quality: 'exact',
      component: { year: 1923, month: 6, day: 1 },
      text: undefined,
    });
  });

  it('keeps a range with its end', () => {
    expect(fromDateDraft(dateDraft({ quality: 'range', year: '1920', endYear: '1930' }))).toEqual({
      quality: 'range',
      component: { year: 1920 },
      end: { year: 1930 },
      text: undefined,
    });
  });

  it('keeps non-numeric month codes as strings', () => {
    expect(fromDateDraft(dateDraft({ year: '1650', month: 'VEND' }))).toEqual({
      quality: 'exact',
      component: { year: 1650, month: 'VEND' },
      text: undefined,
    });
  });

  it('round-trips a text-only date', () => {
    expect(fromDateDraft(dateDraft({ text: 'winter' }))).toEqual({
      quality: 'exact',
      component: undefined,
      text: 'winter',
    });
  });
});

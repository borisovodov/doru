import { describe, expect, it } from 'vitest';
import type { DateDraft, NameDraft, PersonDraft } from '../src/domain/person/draft';
import {
  rebaseDate,
  dateDraftBlank,
  draftInitials,
  draftSpan,
  draftToRecord,
  emptyDate,
  emptyNameDraft,
  emptyVariantDraft,
  fromDateDraft,
  nameDraftDisplay,
  nameDraftEmpty,
  nameDraftToName,
  nameToDraft,
  newPersonDraft,
  partOf,
  personDraftMatches,
  personToDraft,
  setPartValue,
  toDateDraft,
  variantDraftEmpty,
} from '../src/domain/person/draft';
import type { FactRecord, NamePart, PersonName, PersonRecord } from '@doru/core';

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

const person = (overrides: Partial<PersonRecord> = {}): PersonRecord => ({
  id: 'P1',
  sex: 'U',
  names: [],
  facts: [],
  ...overrides,
});

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

  it('replaces every part of the kind with the typed value, keeping the first id', () => {
    const withTwoGiven = nameDraft({
      parts: [part('given', 'Anna', 'G1'), part('given', 'Maria', 'G2'), part('surname', 'Schmidt')],
    });
    const updated = setPartValue(withTwoGiven, 'given', 'Anna Maria');
    expect(updated.parts).toEqual([
      part('surname', 'Schmidt'),
      { id: 'G1', kind: 'given', value: 'Anna Maria', position: 1 },
    ]);
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

  it('applies the modifier only to about dates', () => {
    expect(fromDateDraft(dateDraft({ quality: 'about', year: '1900', modifier: 'CAL' }))).toEqual({
      quality: 'about',
      modifier: 'CAL',
      component: { year: 1900 },
    });
    expect(fromDateDraft(dateDraft({ quality: 'exact', year: '1900', modifier: 'CAL' }))).toEqual({
      quality: 'exact',
      component: { year: 1900 },
    });
  });

  it('carries the date row id and the fractional seconds through rebaseDate', () => {
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
      time: { hour: 9, minute: 0, fraction: '5' },
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

describe('nameToDraft / nameDraftToName', () => {
  const sourceName: PersonName = {
    id: 'N1',
    type: 'maiden',
    language: 'ru',
    primary: true,
    given: 'Ivan',
    surname: 'Petrov',
    variants: [
      {
        id: 'V1',
        kind: 'translation',
        language: 'en',
        given: 'John',
        surname: 'Petrov',
      },
    ],
  };

  it('synthesizes parts from the flat pieces and round-trips them', () => {
    const draftName = nameToDraft(sourceName);
    expect(draftName).toMatchObject({
      id: 'N1',
      type: 'maiden',
      language: 'ru',
      primary: true,
      variants: [
        {
          id: 'V1',
          kind: 'translation',
          language: 'en',
          variants: [],
        },
      ],
    });
    expect(draftName.parts.map((entry) => entry.kind)).toEqual(['given', 'surname']);
    const written = nameDraftToName(draftName);
    expect(written).toMatchObject({
      id: 'N1',
      type: 'maiden',
      language: 'ru',
      primary: true,
      given: 'Ivan',
      surname: 'Petrov',
      variants: [
        {
          id: 'V1',
          kind: 'translation',
          language: 'en',
          given: 'John',
          surname: 'Petrov',
        },
      ],
    });
    expect(written?.parts?.map((entry) => entry.kind)).toEqual(['given', 'surname']);
  });

  it('preserves stored parts verbatim, ids and positions included', () => {
    const stored: PersonName = {
      id: 'N1',
      given: 'Anna',
      surname: 'Schmidt',
      parts: [
        { id: 'G1', kind: 'given', value: 'Anna', position: 0 },
        { id: 'G2', kind: 'given', value: 'Maria', position: 1 },
        { id: 'S1', kind: 'surname', value: 'Schmidt', position: 2 },
      ],
    };
    const draftName = nameToDraft(stored);
    expect(draftName.parts).toEqual(stored.parts);
    const written = nameDraftToName(draftName);
    expect(written?.parts).toEqual(stored.parts);
    expect(written?.given).toBe('Anna');
  });

  it('defaults the variant kind to translation', () => {
    const draftName = nameToDraft({ id: 'N1', variants: [{ id: 'V1', given: 'John' }] });
    expect(draftName.variants[0]?.kind).toBe('translation');
  });

  it('preserves the verbatim display form of imported names', () => {
    const draftName = nameToDraft({ id: 'N1', full: '/Иван Петров/' });
    expect(partOf(draftName, 'full')).toBe('/Иван Петров/');
    const written = nameDraftToName(draftName);
    expect(written?.full).toBe('/Иван Петров/');
    expect(written?.parts?.some((entry) => entry.kind === 'full')).toBe(true);
  });

  it('keeps a name with only a date (no text)', () => {
    const date = { quality: 'exact' as const, component: { year: 1900 } };
    expect(nameDraftEmpty(nameToDraft({ id: 'N1', date }))).toBe(false);
    expect(nameDraftToName(nameToDraft({ id: 'N1', date }))).toMatchObject({ id: 'N1', date });
  });
});

describe('empty name detection', () => {
  it('drops names and variants without text', () => {
    expect(nameDraftEmpty(nameDraft({ parts: [] }))).toBe(true);
    expect(nameDraftEmpty(nameDraft({ parts: [], type: 'maiden' }))).toBe(true);
    expect(nameDraftEmpty(nameDraft())).toBe(false);
    expect(nameDraftEmpty(nameDraft({ parts: [], variants: [emptyVariantDraft()] }))).toBe(true);
    expect(
      nameDraftEmpty(
        nameDraft({
          parts: [],
          variants: [emptyVariantDraft(), { ...emptyVariantDraft(), parts: [part('given', 'John')] }],
        }),
      ),
    ).toBe(false);
    expect(variantDraftEmpty(emptyVariantDraft())).toBe(true);
    expect(variantDraftEmpty({ ...emptyVariantDraft(), parts: [part('surname', 'Petrov')] })).toBe(false);
  });
});

describe('personToDraft', () => {
  it('copies every name, the sex and the birth/death facts', () => {
    const source = person({
      id: 'P1',
      sex: 'M',
      names: [
        { id: 'N1', given: 'Ivan', surname: 'Petrov' },
        { id: 'N2', given: 'Vanya', type: 'aka' },
      ],
      facts: [
        {
          id: 'E1',
          personId: 'P1',
          tag: 'BIRT',
          date: { quality: 'exact', component: { year: 1923 } },
          place: 'Moscow',
        },
        { id: 'E2', personId: 'P1', tag: 'OCCU', value: 'smith' },
      ],
    });
    const result = personToDraft(source);
    expect(result).toMatchObject({
      id: 'P1',
      sex: 'M',
      birth: { ...emptyDate(), year: '1923', place: 'Moscow' },
      death: emptyDate(),
      isNew: false,
    });
    expect(result.names).toHaveLength(2);
    expect(result.names[0]).toMatchObject({ id: 'N1' });
    expect(partOf(result.names[0]!, 'given')).toBe('Ivan');
    expect(result.names[1]).toMatchObject({ id: 'N2', type: 'aka' });
  });
});

describe('personDraftMatches', () => {
  const source = person({
    names: [{ id: 'N1', given: 'Ivan', surname: 'Petrov' }],
    sex: 'M',
    facts: [
      { id: 'E1', personId: 'P1', tag: 'BIRT', date: { quality: 'exact', component: { year: 1923 } }, place: 'Moscow' },
    ],
  });

  it('matches a draft built from the person', () => {
    expect(personDraftMatches(personToDraft(source), source)).toBe(true);
  });

  it('detects a changed name, sex or date', () => {
    const base = personToDraft(source);
    const renamed = { ...base, names: [setPartValue({ ...base.names[0]! }, 'given', 'John')] };
    expect(personDraftMatches(renamed, source)).toBe(false);
    expect(personDraftMatches({ ...base, sex: 'F' }, source)).toBe(false);
    expect(personDraftMatches({ ...base, birth: dateDraft({ year: '1924' }) }, source)).toBe(false);
  });

  it('detects added, removed and reordered names', () => {
    const base = personToDraft(source);
    expect(
      personDraftMatches({ ...base, names: [...base.names, nameDraft({ parts: [part('given', 'Vanya')] })] }, source),
    ).toBe(false);
    expect(personDraftMatches({ ...base, names: [] }, source)).toBe(false);
    const twoNames = person({
      names: [
        { id: 'N1', given: 'Ivan', surname: 'Petrov' },
        { id: 'N2', given: 'Vanya' },
      ],
    });
    expect(
      personDraftMatches({ ...personToDraft(twoNames), names: [...personToDraft(twoNames).names].reverse() }, twoNames),
    ).toBe(false);
  });
});

describe('draftToRecord', () => {
  it('builds a record from a draft, dropping empty birth/death and empty names', () => {
    const record = draftToRecord(draft({ names: [nameDraft(), nameDraft({ parts: [] })], sex: 'M' }));
    expect(record).toMatchObject({ id: 'P1', sex: 'M', facts: [] });
    expect(record.names).toHaveLength(1);
    expect(record.names[0]).toMatchObject({ given: 'Ivan', surname: 'Petrov' });
  });

  it('keeps no name entry for a fully empty draft', () => {
    const record = draftToRecord(draft({ names: [] }));
    expect(record.names).toEqual([]);
  });

  it('writes every name of the draft, preserving ids and variants', () => {
    const record = draftToRecord(
      draft({
        names: [
          nameDraft({
            id: 'N1',
            primary: true,
            variants: [
              {
                ...emptyVariantDraft(),
                id: 'V1',
                kind: 'romanized',
                language: 'en',
                parts: [part('given', 'Ivan'), part('surname', 'Petrov')],
              },
            ],
          }),
          nameDraft({ id: 'N2', parts: [part('given', 'Vanya')], type: 'aka' }),
        ],
      }),
    );
    expect(record.names).toHaveLength(2);
    expect(record.names[0]).toMatchObject({
      id: 'N1',
      primary: true,
      given: 'Ivan',
      surname: 'Petrov',
      variants: [{ id: 'V1', kind: 'romanized', language: 'en', given: 'Ivan', surname: 'Petrov' }],
    });
    expect(record.names[0]?.parts?.map((entry) => entry.kind)).toEqual(['given', 'surname']);
    expect(record.names[1]).toMatchObject({ id: 'N2', type: 'aka', given: 'Vanya' });
  });

  it('updates birth and death in place while preserving other facts', () => {
    const existing = person({
      names: [{ id: 'N1', given: 'Ivan', surname: 'Petrov' }],
      facts: [
        { id: 'E1', personId: 'P1', tag: 'BIRT', date: { quality: 'exact', component: { year: 1900 } } },
        { id: 'E2', personId: 'P1', tag: 'OCCU', value: 'smith' },
        { id: 'E3', personId: 'P1', tag: 'DEAT', date: { quality: 'exact', component: { year: 1950 } } },
      ],
    });
    const record = draftToRecord(
      draft({
        names: [nameDraft({ id: 'N1' })],
        sex: 'M',
        birth: dateDraft({ year: '1923', place: 'Moscow' }),
        death: dateDraft(),
      }),
      existing,
    );
    expect(record.facts.map((fact) => fact.tag)).toEqual(['OCCU', 'BIRT', 'DEAT']);
    expect(record.facts.find((fact) => fact.tag === 'BIRT')).toMatchObject({
      id: 'E1',
      date: { quality: 'exact', component: { year: 1923 } },
      place: 'Moscow',
    });
    // An emptied draft clears the stored date/place but keeps the fact:
    // the quick editor must not delete data it cannot show.
    expect(record.facts.find((fact) => fact.tag === 'DEAT')).toMatchObject({
      id: 'E3',
      date: undefined,
      place: undefined,
    });
  });

  it('keeps every field of an unchanged birth fact on an unrelated edit', () => {
    const richBirth: FactRecord = {
      id: 'E1',
      personId: 'P1',
      tag: 'BIRT',
      date: { id: 'D1', quality: 'exact', component: { year: 1900 }, time: { hour: 12, minute: 30 } },
      place: 'Moscow',
      placeId: 'PL1',
      addressId: 'A1',
      sortDate: { quality: 'exact', component: { year: 1899 } },
      cause: 'old age',
      ages: [{ id: 'AG1', years: 80 }],
      participants: [{ id: 'PR1', value: 'midwife', role: 'witness', position: 0 }],
      flags: ['preferred'],
    };
    const existing = person({
      names: [{ id: 'N1', given: 'Ivan', surname: 'Petrov' }],
      facts: [richBirth],
    });
    const record = draftToRecord(
      draft({
        names: [nameDraft({ id: 'N1', parts: [part('given', 'Vanya'), part('surname', 'Petrov')] })],
        birth: personToDraft(existing).birth,
      }),
      existing,
    );
    expect(record.facts.find((fact) => fact.tag === 'BIRT')).toEqual(richBirth);
  });

  it('round-trips the calendar and time when the visible fields change', () => {
    const existing = person({
      facts: [
        {
          id: 'E1',
          personId: 'P1',
          tag: 'BIRT',
          date: {
            id: 'D1',
            quality: 'exact',
            component: { calendar: 'julian', year: 1900, month: 10, day: 5 },
            time: { hour: 12, minute: 0, second: 0 },
          },
        },
      ],
    });
    const birth = personToDraft(existing).birth;
    birth.year = '1901';
    const record = draftToRecord(draft({ birth }), existing);
    expect(record.facts.find((fact) => fact.tag === 'BIRT')?.date).toEqual({
      id: 'D1',
      quality: 'exact',
      component: { calendar: 'julian', year: 1901, month: 10, day: 5 },
      time: { hour: 12, minute: 0, second: 0 },
    });
  });

  it('drops the place link when the place text changes', () => {
    const existing = person({
      facts: [
        {
          id: 'E1',
          personId: 'P1',
          tag: 'BIRT',
          date: { quality: 'exact', component: { year: 1900 } },
          place: 'Moscow',
          placeId: 'PL1',
        },
      ],
    });
    const record = draftToRecord(draft({ birth: dateDraft({ year: '1900', place: 'Kazan' }) }), existing);
    const birth = record.facts.find((fact) => fact.tag === 'BIRT');
    expect(birth).toMatchObject({ id: 'E1', place: 'Kazan' });
    expect(birth?.placeId).toBeUndefined();
  });

  it('creates fresh birth/death facts when there is no existing person', () => {
    const record = draftToRecord(draft({ birth: dateDraft({ year: '1923' }) }));
    expect(record.facts).toEqual([
      {
        id: expect.any(String) as string,
        personId: 'P1',
        tag: 'BIRT',
        date: { quality: 'exact', component: { year: 1923 } },
        place: undefined,
      },
    ]);
  });

  it('keeps a place-only fact without a date', () => {
    const record = draftToRecord(draft({ birth: dateDraft({ place: 'Moscow' }) }));
    expect(record.facts[0]).toMatchObject({ tag: 'BIRT', place: 'Moscow', date: undefined });
  });

  it('trims part values typed through the form', () => {
    const typed = setPartValue(setPartValue(emptyNameDraft(), 'given', '  Ivan '), 'surname', ' Petrov ');
    const record = draftToRecord(draft({ names: [typed] }));
    expect(record.names[0]).toMatchObject({ given: 'Ivan', surname: 'Petrov' });
  });
});

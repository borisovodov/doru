import { describe, expect, it } from 'vitest';
import type { DateDraft, PersonDraft } from '../src/person/draft';
import {
  draftInitials,
  draftSpan,
  draftToRecord,
  emptyDate,
  fromDateDraft,
  newPersonDraft,
  personDraftMatches,
  personToDraft,
  toDateDraft,
} from '../src/person/draft';
import type { PersonRecord } from '@doru/core';

const draft = (overrides: Partial<PersonDraft> = {}): PersonDraft => ({
  id: 'P1',
  given: '',
  surname: '',
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
    });
  });
});

describe('draftInitials', () => {
  it('returns "?" for an empty draft', () => {
    expect(draftInitials(draft())).toBe('?');
  });

  it('derives initials from given and surname', () => {
    expect(draftInitials(draft({ given: 'Ivan', surname: 'Petrov' }))).toBe('IP');
  });

  it('works with a single part', () => {
    expect(draftInitials(draft({ given: 'Ivan' }))).toBe('I');
    expect(draftInitials(draft({ surname: 'Petrov' }))).toBe('P');
  });

  it('ignores whitespace-only parts', () => {
    expect(draftInitials(draft({ given: '   ', surname: 'Petrov' }))).toBe('P');
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
    expect(
      draftSpan(draft({ birth: dateDraft({ year: '1990' }), death: dateDraft({ year: '1923' }) })),
    ).toBe('1990 – 1923');
    expect(
      draftSpan(draft({ birth: dateDraft({ year: '1800' }), death: dateDraft({ year: '1990' }) })),
    ).toBe('1800 – 1990');
  });

  it('appends the age for approximate dates but not for text dates', () => {
    expect(
      draftSpan(
        draft({ birth: dateDraft({ year: '1923', quality: 'about' }), death: dateDraft({ year: '1990' }) }),
      ),
    ).toBe('~1923 – 1990 (67)');
    expect(
      draftSpan(
        draft({ birth: dateDraft({ year: '1923' }), death: dateDraft({ year: '1990', text: 'summer' }) }),
      ),
    ).toBe('1923 – 1990 summer');
  });
});

describe('newPersonDraft', () => {
  it('builds an empty new-person draft with a fresh id', () => {
    const created = newPersonDraft();
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created).toMatchObject({ given: '', surname: '', sex: 'U', isNew: true });
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
      year: '1920',
      month: '3',
      day: '4',
      endYear: '1930',
      endMonth: '5',
      endDay: '6',
      text: 'winter',
      quality: 'range',
      place: '',
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

describe('personToDraft', () => {
  it('copies the primary name, sex and the birth/death facts', () => {
    const source = person({
      id: 'P1',
      sex: 'M',
      names: [{ id: 'N1', given: 'Ivan', surname: 'Petrov' }],
      facts: [
        { id: 'E1', personId: 'P1', tag: 'BIRT', date: { quality: 'exact', component: { year: 1923 } }, place: 'Moscow' },
        { id: 'E2', personId: 'P1', tag: 'OCCU', value: 'smith' },
      ],
    });
    expect(personToDraft(source)).toEqual({
      id: 'P1',
      given: 'Ivan',
      surname: 'Petrov',
      sex: 'M',
      birth: { ...emptyDate(), year: '1923', place: 'Moscow' },
      death: emptyDate(),
      isNew: false,
    });
  });
});

describe('personDraftMatches', () => {
  const source = person({
    names: [{ id: 'N1', given: 'Ivan', surname: 'Petrov' }],
    sex: 'M',
    facts: [{ id: 'E1', personId: 'P1', tag: 'BIRT', date: { quality: 'exact', component: { year: 1923 } }, place: 'Moscow' }],
  });

  it('matches a draft built from the person', () => {
    expect(personDraftMatches(personToDraft(source), source)).toBe(true);
  });

  it('detects a changed name, sex or date', () => {
    expect(personDraftMatches({ ...personToDraft(source), given: 'John' }, source)).toBe(false);
    expect(personDraftMatches({ ...personToDraft(source), sex: 'F' }, source)).toBe(false);
    expect(personDraftMatches({ ...personToDraft(source), birth: dateDraft({ year: '1924' }) }, source)).toBe(false);
  });
});

describe('draftToRecord', () => {
  it('builds a record from a draft, dropping empty birth/death', () => {
    const record = draftToRecord(draft({ given: 'Ivan', surname: 'Petrov', sex: 'M' }));
    expect(record).toEqual({
      id: 'P1',
      sex: 'M',
      names: [{ id: expect.any(String), given: 'Ivan', surname: 'Petrov', full: 'Ivan Petrov' }],
      facts: [],
    });
  });

  it('keeps no name entry for a fully empty draft', () => {
    const record = draftToRecord(draft());
    expect(record.names).toEqual([]);
  });

  it('rebuilds birth and death while preserving other facts and extra names', () => {
    const existing = person({
      names: [
        { id: 'N1', given: 'Ivan', surname: 'Petrov', full: 'Ivan Petrov' },
        { id: 'N2', given: 'Vanya', type: 'aka' },
      ],
      facts: [
        { id: 'E1', personId: 'P1', tag: 'BIRT', date: { quality: 'exact', component: { year: 1900 } } },
        { id: 'E2', personId: 'P1', tag: 'OCCU', value: 'smith' },
        { id: 'E3', personId: 'P1', tag: 'DEAT', date: { quality: 'exact', component: { year: 1950 } } },
      ],
    });
    const record = draftToRecord(
      draft({
        given: 'Ivan',
        surname: 'Petrov',
        sex: 'M',
        birth: dateDraft({ year: '1923', place: 'Moscow' }),
        death: dateDraft(),
      }),
      existing,
    );
    expect(record.names).toHaveLength(2);
    expect(record.names[0]?.id).toBe('N1');
    expect(record.facts.map((fact) => fact.tag)).toEqual(['OCCU', 'BIRT']);
    expect(record.facts.find((fact) => fact.tag === 'BIRT')).toMatchObject({
      id: 'E1',
      date: { quality: 'exact', component: { year: 1923 } },
      place: 'Moscow',
    });
  });

  it('creates fresh birth/death facts when there is no existing person', () => {
    const record = draftToRecord(draft({ birth: dateDraft({ year: '1923' }) }));
    expect(record.facts).toEqual([
      {
        id: expect.any(String),
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

  it('preserves a trimmed given and surname', () => {
    const record = draftToRecord(draft({ given: '  Ivan ', surname: ' Petrov ' }));
    expect(record.names[0]).toMatchObject({ given: 'Ivan', surname: 'Petrov' });
  });
});

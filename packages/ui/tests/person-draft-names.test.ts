import { describe, expect, it } from 'vitest';
import type { DateDraft, NameDraft, PersonDraft } from '../src/domain/person/draft';
import {
  draftToRecord,
  emptyDate,
  emptyNameDraft,
  emptyVariantDraft,
  nameDraftEmpty,
  nameDraftToName,
  nameToDraft,
  partOf,
  personDraftMatches,
  personToDraft,
  setPartValue,
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

  it('preserves the type and primary marker of imported variants', () => {
    const draftName = nameToDraft({
      id: 'N1',
      variants: [{ id: 'V1', kind: 'translation', type: 'aka', primary: true, given: 'John' }],
    });
    expect(draftName.variants[0]).toMatchObject({ type: 'aka', primary: true });
    expect(nameDraftToName(draftName)?.variants?.[0]).toMatchObject({ type: 'aka', primary: true });
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

  it('keeps the X sex through the draft and back', () => {
    const source = person({ id: 'P1', sex: 'X', names: [], facts: [] });
    const draft = personToDraft(source);
    expect(draft.sex).toBe('X');
    expect(draftToRecord({ ...draft, deathStatus: 'dead', deathStatusTouched: true }).deathStatus).toBe('dead');
    expect(draftToRecord(draft).sex).toBe('X');
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
    expect(personDraftMatches({ ...base, addressId: 'A1', addressTouched: true }, source)).toBe(false);
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

  it('carries vendor name fields through an edit', () => {
    const existing = person({
      names: [
        {
          id: 'N1',
          given: 'Anna',
          callName: 'Anya',
          middleName: 'Maria',
          patronymic: 'Ivanovna',
          marriedName: 'Sidorova',
          aka: 'Annette',
          hebrewName: 'Chana',
          title: 'Dr',
          shortName: 'A. Petrova',
          nameAsRecorded: 'Anna Petrova',
          givenNameUsed: 'Anya',
        },
      ],
    });
    expect(draftToRecord(personToDraft(existing), existing).names[0]).toMatchObject({
      callName: 'Anya',
      middleName: 'Maria',
      patronymic: 'Ivanovna',
      marriedName: 'Sidorova',
      aka: 'Annette',
      hebrewName: 'Chana',
      title: 'Dr',
      shortName: 'A. Petrova',
      nameAsRecorded: 'Anna Petrova',
      givenNameUsed: 'Anya',
    });
  });

  it('carries the imported xref through an edit', () => {
    const existing = person({ xref: '@I7@' });
    expect(draftToRecord(personToDraft(existing), existing).xref).toBe('@I7@');
    expect(draftToRecord(personToDraft(existing)).xref).toBeUndefined();
  });

  it('keeps an untouched address but honours an explicit clear or change', () => {
    const source = person({ addressId: 'A1' });
    const existing = person({ addressId: 'A2' });
    expect(draftToRecord(personToDraft(source), existing).addressId).toBe('A2');
    expect(
      draftToRecord({ ...personToDraft(source), addressTouched: true, addressId: undefined }, existing).addressId,
    ).toBeUndefined();
    expect(draftToRecord({ ...personToDraft(source), addressTouched: true, addressId: 'A3' }, existing).addressId).toBe(
      'A3',
    );
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

  it('keeps a refreshed death status when the draft did not edit it', () => {
    const source = person({ deathStatus: 'alive' });
    const existing = person({ deathStatus: 'dead' });
    expect(draftToRecord(personToDraft(source), existing).deathStatus).toBe('dead');
    expect(
      draftToRecord({ ...personToDraft(source), deathStatusTouched: true, deathStatus: 'alive' }, existing).deathStatus,
    ).toBe('alive');
    expect(
      draftToRecord({ ...personToDraft(source), deathStatusTouched: true, deathStatus: undefined }, existing)
        .deathStatus,
    ).toBeUndefined();
  });
});

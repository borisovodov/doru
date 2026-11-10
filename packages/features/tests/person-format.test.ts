import { describe, expect, it } from 'vitest';
import type { FamilyRecord, PersonRecord } from '@doru/core';
import { displayName, factOwnerName, familyLabel, formatDate, initials, lifeSpan, qualityMark, years } from '../src/person/format';

const person = (overrides: Partial<PersonRecord> = {}): PersonRecord => ({
  id: 'P1',
  sex: 'U',
  names: [],
  facts: [],
  ...overrides,
});

describe('displayName', () => {
  it('returns "?" for a missing person', () => {
    expect(displayName(undefined)).toBe('?');
  });

  it('falls back to the id when the person has no names', () => {
    expect(displayName(person())).toBe('P1');
  });

  it('prefers the cleaned full name over the parts', () => {
    expect(displayName(person({ names: [{ id: 'N1', full: '/Petrov/ Ivan //' }] }))).toBe('Petrov Ivan');
  });

  it('falls back to given and surname when the full name is empty', () => {
    expect(displayName(person({ names: [{ id: 'N1', full: '///' }] }))).toBe('P1');
    expect(
      displayName(person({ names: [{ id: 'N1', given: 'Ivan', surname: 'Petrov' }] })),
    ).toBe('Ivan Petrov');
  });

  it('joins only the parts that are present', () => {
    expect(displayName(person({ names: [{ id: 'N1', given: 'Ivan' }] }))).toBe('Ivan');
  });
});

describe('initials', () => {
  it('returns "?" without a name', () => {
    expect(initials(person())).toBe('?');
  });

  it('derives initials from the first two words of the full name', () => {
    expect(initials(person({ names: [{ id: 'N1', full: '/Petrov/ Ivan Sergeevich' }] }))).toBe('PI');
  });

  it('derives initials from given and surname', () => {
    expect(initials(person({ names: [{ id: 'N1', given: 'Ivan', surname: 'Petrov' }] }))).toBe('IP');
  });

  it('returns an empty string when the full name has no words', () => {
    expect(initials(person({ names: [{ id: 'N1', full: '   ' }] }))).toBe('');
  });
});

describe('lifeSpan', () => {
  const withFacts = (...facts: PersonRecord['facts']): PersonRecord =>
    person({
      facts,
    });

  const birth = (year: number) => ({
    id: 'E1',
    personId: 'P1',
    tag: 'BIRT',
    date: { quality: 'exact' as const, component: { year } },
  });
  const death = (year: number) => ({
    id: 'E2',
    personId: 'P1',
    tag: 'DEAT',
    date: { quality: 'exact' as const, component: { year } },
  });

  it('is empty without dates', () => {
    expect(lifeSpan(person())).toBe('');
  });

  it('shows one side when only birth or death is known', () => {
    expect(lifeSpan(withFacts(birth(1923)))).toBe('1923');
    expect(lifeSpan(withFacts(death(1990)))).toBe('1990');
  });

  it('appends the age when both years are exact', () => {
    expect(lifeSpan(withFacts(birth(1923), death(1990)))).toBe('1923 – 1990 (67)');
  });

  it('skips the age when it is negative or implausible', () => {
    expect(lifeSpan(withFacts(birth(1990), death(1923)))).toBe('1990 – 1923');
    expect(lifeSpan(withFacts(birth(1800), death(1990)))).toBe('1800 – 1990');
  });

  it('appends the age for approximate dates but not for text dates', () => {
    expect(
      lifeSpan(
        withFacts(
          { ...birth(1923), date: { quality: 'about', component: { year: 1923 } } },
          death(1990),
        ),
      ),
    ).toBe('~1923 – 1990 (67)');
    expect(
      lifeSpan(
        withFacts(
          birth(1923),
          { ...death(1990), date: { quality: 'exact', component: { year: 1990 }, text: 'summer' } },
        ),
      ),
    ).toBe('1923 – 1990 summer');
  });
});

describe('years', () => {
  const withFacts = (...facts: PersonRecord['facts']): PersonRecord => person({ facts });

  it('is empty without birth or death', () => {
    expect(years(person())).toBe('');
  });

  it('shows the death year alone with an em dash', () => {
    expect(
      years(
        withFacts({
          id: 'E2',
          personId: 'P1',
          tag: 'DEAT',
          date: { quality: 'exact', component: { year: 1990 } },
        }),
      ),
    ).toBe('— 1990');
  });
});

describe('familyLabel', () => {
  const byId = (entries: PersonRecord[]): Map<string, PersonRecord> => new Map(entries.map((entry) => [entry.id, entry]));

  it('joins partner names with "&"', () => {
    const family: FamilyRecord = { id: 'F1', partners: ['P1', 'P2'], children: [] };
    expect(
      familyLabel(
        family,
        byId([person({ id: 'P1', names: [{ id: 'N1', given: 'Ivan' }] }), person({ id: 'P2', names: [{ id: 'N2', given: 'Maria' }] })]),
      ),
    ).toBe('Ivan & Maria');
  });

  it('falls back to the first child when there are no partners', () => {
    const family: FamilyRecord = { id: 'F1', partners: [], children: ['K1', 'K2'] };
    expect(
      familyLabel(
        family,
        byId([person({ id: 'K1', names: [{ id: 'N1', given: 'Kolya' }] }), person({ id: 'K2' })]),
      ),
    ).toBe('Kolya …');
  });

  it('falls back to the xref and then the id', () => {
    expect(familyLabel({ id: 'F1', partners: [], children: [] }, byId([]))).toBe('F1');
    expect(familyLabel({ id: 'F1', xref: '@F1@', partners: [], children: [] }, byId([]))).toBe('@F1@');
  });
});

describe('factOwnerName', () => {
  const byId = (entries: PersonRecord[]): Map<string, PersonRecord> => new Map(entries.map((entry) => [entry.id, entry]));

  it('names the owner person', () => {
    const fact = { id: 'E1', personId: 'P1', tag: 'BIRT' };
    expect(factOwnerName(fact, byId([person({ names: [{ id: 'N1', given: 'Ivan' }] })]), new Map())).toBe('Ivan');
  });

  it('names the owner family or returns "?"', () => {
    const fact = { id: 'E1', familyId: 'F1', tag: 'MARR' };
    const family: FamilyRecord = { id: 'F1', partners: ['P1'], children: [] };
    expect(factOwnerName(fact, byId([person({ names: [{ id: 'N1', given: 'Ivan' }] })]), new Map([['F1', family]]))).toBe('Ivan');
    expect(factOwnerName(fact, byId([]), new Map())).toBe('?');
  });

  it('returns "?" when the fact has no owner', () => {
    expect(factOwnerName({ id: 'E1', tag: 'BIRT' }, byId([]), new Map())).toBe('?');
  });
});

describe('formatDate', () => {
  it('returns an empty string for a bare date', () => {
    expect(formatDate({ quality: 'exact' })).toBe('');
  });

  it('formats the year with the quality mark', () => {
    expect(formatDate({ quality: 'about', component: { year: 1923 } })).toBe('~1923');
  });

  it('marks BCE years', () => {
    expect(formatDate({ quality: 'exact', component: { year: 44, epoch: 'BCE' } })).toBe('44 BC');
  });

  it('appends the range end year', () => {
    expect(
      formatDate({ quality: 'range', component: { year: 1920 }, end: { year: 1930 } }),
    ).toBe('1920 — 1930');
  });

  it('appends the free text', () => {
    expect(formatDate({ quality: 'exact', component: { year: 1923 }, text: 'winter' })).toBe('1923 winter');
  });
});

describe('qualityMark', () => {
  it('maps the quality kinds to marks', () => {
    expect(qualityMark('about')).toBe('~');
    expect(qualityMark('before')).toBe('<');
    expect(qualityMark('after')).toBe('>');
    expect(qualityMark('exact')).toBe('');
    expect(qualityMark('range')).toBe('');
    expect(qualityMark('unknown')).toBe('');
  });
});

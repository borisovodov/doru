import { describe, expect, it } from 'vitest';
import type { FactRecord } from '@doru/core';
import { emptyDate } from '../src/domain/person/draft';
import { emptyFactDraft, factDraftToRecord, factKindLabel, factToDraft } from '../src/domain/fact/factDraft';

const fact = (overrides: Partial<FactRecord> = {}): FactRecord => ({
  id: 'F1',
  personId: 'P1',
  tag: 'BIRT',
  ...overrides,
});

describe('emptyFactDraft', () => {
  it('builds an empty draft with the owner ids and a fresh id', () => {
    const draft = emptyFactDraft({ personId: 'P1' });
    expect(draft.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(draft).toMatchObject({
      personId: 'P1',
      familyId: undefined,
      tag: '',
      type: '',
      value: '',
      negation: false,
      date: emptyDate(),
      sortDate: emptyDate(),
      agency: '',
      religiousAffiliation: '',
      cause: '',
      sentence: '',
      quality: '',
      ages: [],
      participants: [],
      flags: [],
    });
  });
});

describe('factToDraft / factDraftToRecord', () => {
  it('round-trips every field', () => {
    const source = fact({
      tag: 'DEAT',
      type: 'EVEN',
      value: 'fell',
      negation: true,
      date: { quality: 'about', component: { year: 1990 } },
      sortDate: { quality: 'exact', component: { year: 1991 } },
      place: 'Moscow',
      placeId: 'PL1',
      addressId: 'AD1',
      agency: 'Archive',
      religiousAffiliation: 'Orthodox',
      cause: 'pneumonia',
      sentence: 'He died in {0}.',
      quality: '2',
      ages: [
        { id: 'A1', role: 'HUSB', years: 67, phrase: 'old' },
        { id: 'A2', years: 5, months: 3 },
      ],
      participants: [
        { id: 'W1', personId: 'P2', role: 'witness', position: 0 },
        { id: 'W2', value: 'Unknown woman', position: 1 },
      ],
      flags: ['private', 'tentative'],
    });
    const draft = factToDraft(source);
    expect(draft).toMatchObject({
      id: 'F1',
      personId: 'P1',
      tag: 'DEAT',
      type: 'EVEN',
      value: 'fell',
      negation: true,
      date: { ...emptyDate(), year: '1990', quality: 'about', place: 'Moscow' },
      sortDate: { ...emptyDate(), year: '1991' },
      placeId: 'PL1',
      addressId: 'AD1',
      agency: 'Archive',
      religiousAffiliation: 'Orthodox',
      cause: 'pneumonia',
      sentence: 'He died in {0}.',
      quality: '2',
      ages: source.ages,
      participants: source.participants,
      flags: ['private', 'tentative'],
    });
    expect(factDraftToRecord(draft)).toEqual(source);
  });

  it('drops empty optional fields', () => {
    const draft = emptyFactDraft({ personId: 'P1' });
    const record = factDraftToRecord({ ...draft, tag: 'BIRT' });
    expect(record).toEqual({
      id: draft.id,
      personId: 'P1',
      familyId: undefined,
      tag: 'BIRT',
      type: undefined,
      value: undefined,
      negation: undefined,
      date: undefined,
      sortDate: undefined,
      place: undefined,
      placeId: undefined,
      addressId: undefined,
      agency: undefined,
      religiousAffiliation: undefined,
      cause: undefined,
      sentence: undefined,
      quality: undefined,
      ages: undefined,
      participants: undefined,
      flags: undefined,
    });
  });

  it('defaults an empty tag to EVEN', () => {
    const record = factDraftToRecord(emptyFactDraft({ personId: 'P1' }));
    expect(record.tag).toBe('EVEN');
  });

  it('reads the place from the date draft and ignores the sort date place', () => {
    const draft = factToDraft(fact({ date: { quality: 'exact', component: { year: 1900 } }, place: 'Tula' }));
    draft.date.place = 'Kazan';
    draft.sortDate.place = 'ignored';
    const record = factDraftToRecord(draft);
    expect(record.place).toBe('Kazan');
    expect(record.sortDate).toBeUndefined();
  });

  it('preserves extra sub-row fields verbatim', () => {
    const source = fact({
      ages: [{ id: 'A1', personId: 'P9', bound: 'before', weeks: 2 }],
    });
    const record = factDraftToRecord(factToDraft(source));
    expect(record.ages).toEqual(source.ages);
  });

  it('keeps the invisible date fields of an unchanged fact on an unrelated edit', () => {
    const source = fact({
      date: {
        id: 'D1',
        quality: 'exact',
        component: { calendar: 'julian', year: 1900, month: 10, day: 5 },
        time: { hour: 12, minute: 30 },
      },
      place: 'Tula',
      placeId: 'PL1',
      sortDate: { quality: 'exact', component: { year: 1899 } },
    });
    const draft = factToDraft(source);
    draft.value = 'edited elsewhere';
    const record = factDraftToRecord(draft, source);
    expect(record.date).toEqual(source.date);
    expect(record.sortDate).toEqual(source.sortDate);
    expect(record.placeId).toBe('PL1');
  });

  it('round-trips the calendar, modifier and time when the visible fields change', () => {
    const source = fact({
      date: {
        id: 'D1',
        quality: 'about',
        modifier: 'ABT',
        component: { calendar: 'julian', year: 1900, month: 10, day: 5 },
        time: { hour: 12, minute: 0 },
      },
    });
    const draft = factToDraft(source);
    draft.date.year = '1901';
    const record = factDraftToRecord(draft, source);
    expect(record.date).toEqual({
      id: 'D1',
      quality: 'about',
      modifier: 'ABT',
      component: { calendar: 'julian', year: 1901, month: 10, day: 5 },
      time: { hour: 12, minute: 0 },
    });
  });

  it('drops the place link when the place text changes', () => {
    const source = fact({ place: 'Tula', placeId: 'PL1' });
    const draft = factToDraft(source);
    draft.date.place = 'Kazan';
    const record = factDraftToRecord(draft, source);
    expect(record.place).toBe('Kazan');
    expect(record.placeId).toBeUndefined();
  });
});

describe('factKindLabel', () => {
  it('joins the tag and the subtype', () => {
    expect(factKindLabel(factToDraft(fact({ tag: 'EVEN', type: 'graduation' })))).toBe('EVEN · graduation');
    expect(factKindLabel(factToDraft(fact()))).toBe('BIRT');
    expect(factKindLabel(emptyFactDraft({}))).toBe('—');
  });
});

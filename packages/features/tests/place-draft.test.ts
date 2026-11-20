import { describe, expect, it } from 'vitest';
import type { PlaceRecord } from '@doru/core';
import { emptyDate } from '@doru/ui/domain';
import {
  emptyPlaceDraft,
  emptyPlaceNameDraft,
  mergePlaceDraft,
  placeDraftMatches,
  placeDraftName,
  placeDraftToRecord,
  placeToDraft,
  withPlaceNamePositions,
} from '../src/place/placeDraft';

const place = (overrides: Partial<PlaceRecord> = {}): PlaceRecord => ({
  id: 'PL1',
  names: [{ id: 'N1', position: 0, value: 'Tula' }],
  ...overrides,
});

describe('emptyPlaceDraft', () => {
  it('builds an empty draft with a fresh id', () => {
    const draft = emptyPlaceDraft();
    expect(draft.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(draft).toMatchObject({
      latitude: '',
      longitude: '',
      verified: false,
      names: [],
      postalCodes: [],
      hierarchy: [],
    });
  });
});

describe('placeToDraft / placeDraftToRecord', () => {
  it('round-trips every field', () => {
    const stored: PlaceRecord = {
      id: 'PL1',
      xref: '@P1@',
      latitude: 54.19,
      longitude: 37.61,
      verified: true,
      form: ['city', 'region', 'country'],
      abbreviation: 'TUL',
      preposition: 'in',
      govId: 'RU-TUL',
      maidenhead: 'KO91',
      placeType: 'city',
      names: [
        {
          id: 'N1',
          kind: 'official',
          position: 0,
          value: 'Tula',
          addition: 'Tula Oblast',
          abbreviation: 'Tul.',
          abbreviationType: 'ISO',
          date: { quality: 'exact', component: { year: 1800 } },
        },
        { id: 'N2', kind: 'official', position: 1, value: 'Tula Oblast' },
        { id: 'N3', kind: 'translation', language: 'en', position: 2, value: 'Tula' },
      ],
      hierarchy: [{ id: 'H1', parentId: 'PL2', type: 'poli' }],
      postalCodes: [
        { id: 'PC1', code: '300000', date: { quality: 'exact', component: { year: 1930 } } },
        { id: 'PC2', code: '300999' },
      ],
    };
    const draft = placeToDraft(stored);
    expect(draft).toMatchObject({
      id: 'PL1',
      xref: '@P1@',
      latitude: '54.19',
      longitude: '37.61',
      verified: true,
      form: 'city, region, country',
      abbreviation: 'TUL',
      preposition: 'in',
      govId: 'RU-TUL',
      maidenhead: 'KO91',
      placeType: 'city',
      hierarchy: [{ id: 'H1', parentId: 'PL2', type: 'poli' }],
    });
    expect(draft.names).toHaveLength(3);
    expect(draft.names[1]).toMatchObject({ id: 'N2', kind: 'official', value: 'Tula Oblast' });
    expect(draft.postalCodes[0]).toMatchObject({ id: 'PC1', code: '300000', date: { ...emptyDate(), year: '1930' } });
    expect(placeDraftToRecord(draft)).toEqual(stored);
  });

  it('normalizes name positions to the list order and keeps date ids', () => {
    const stored: PlaceRecord = {
      id: 'PL1',
      names: [
        {
          id: 'N1',
          kind: 'official',
          position: 0,
          value: 'Tula',
          date: { id: 'PD1', quality: 'exact', component: { year: 1800 } },
        },
        { id: 'N2', kind: 'official', position: 1, value: 'Tula Oblast' },
      ],
      hierarchy: [{ id: 'H1', parentId: 'PL2', date: { id: 'PD2', quality: 'exact', component: { year: 1900 } } }],
      postalCodes: [{ id: 'PC1', code: '300000', date: { id: 'PD3', quality: 'exact', component: { year: 1930 } } }],
    };
    const draft = placeToDraft(stored);
    draft.names = withPlaceNamePositions([draft.names[1]!, draft.names[0]!]);
    const after = placeDraftToRecord(draft, stored);
    expect(after.names.map((name) => [name.id, name.position])).toEqual([
      ['N2', 0],
      ['N1', 1],
    ]);
    expect(after.names[1]?.date?.id).toBe('PD1');
    expect(after.hierarchy?.[0]?.date?.id).toBe('PD2');
    expect(after.postalCodes?.[0]?.date?.id).toBe('PD3');
  });

  it('merges refreshed rows into a dirty draft', () => {
    const previous = place({
      names: [
        { id: 'N1', position: 0, value: 'Tula', date: { id: 'D1', quality: 'exact', component: { year: 1800 } } },
      ],
      postalCodes: [{ id: 'PC1', code: '300000', date: { id: 'D2', quality: 'exact', component: { year: 1930 } } }],
    });
    const refreshed = place({
      names: [
        {
          id: 'N1',
          position: 0,
          value: 'Tula District',
          date: { id: 'D3', quality: 'exact', component: { year: 1800 } },
        },
        { id: 'N2', position: 1, value: 'Tula Oblast' },
      ],
      postalCodes: [{ id: 'PC1', code: '300000', date: { id: 'D4', quality: 'exact', component: { year: 1930 } } }],
    });
    const draft = placeToDraft(previous);
    draft.names[0]!.abbreviation = 'Tul.';
    draft.abbreviation = 'TUL';

    const merged = mergePlaceDraft(draft, previous, refreshed);

    expect(merged.abbreviation).toBe('TUL');
    expect(merged.names[0]).toMatchObject({
      id: 'N1',
      value: 'Tula District',
      abbreviation: 'Tul.',
      date: { year: '1800' },
    });
    expect(merged.names[1]).toMatchObject({ id: 'N2', value: 'Tula Oblast' });
    expect(merged.postalCodes[0]).toMatchObject({ id: 'PC1', date: { year: '1930' } });
    const saved = placeDraftToRecord(merged, refreshed);
    expect(saved.names[0]?.date?.id).toBe('D3');
    expect(saved.postalCodes?.[0]?.date?.id).toBe('D4');
  });

  it('drops empty names, links and postal codes; parses coordinates', () => {
    const record = placeDraftToRecord({
      ...emptyPlaceDraft(),
      latitude: '54.19',
      longitude: 'abc',
      names: [{ ...emptyPlaceNameDraft(0), id: 'N1', value: '  Tula  ' }],
      postalCodes: [{ id: 'PC1', code: '  ', date: emptyDate() }],
      hierarchy: [{ id: 'H1', parentId: '', type: '', date: emptyDate() }],
    });
    expect(record.latitude).toBe(54.19);
    expect(record.longitude).toBeUndefined();
    expect(record.names).toEqual([{ id: 'N1', kind: 'official', position: 0, value: 'Tula' }]);
    expect(record.postalCodes).toEqual([]);
    expect(record.hierarchy).toEqual([]);
  });
});

describe('placeDraftName', () => {
  it('joins the official rows, smallest first', () => {
    const draft = placeToDraft(
      place({
        names: [
          { id: 'N1', position: 0, value: 'Tula' },
          { id: 'N2', position: 1, value: 'Tula Oblast' },
          { id: 'N3', kind: 'translation', language: 'en', position: 0, value: 'Tula' },
        ],
      }),
    );
    expect(placeDraftName(draft)).toBe('Tula, Tula Oblast');
  });
});

describe('placeDraftMatches', () => {
  it('matches a draft built from the place', () => {
    const stored = place({ postalCodes: [{ id: 'PC1', code: '300000' }] });
    expect(placeDraftMatches(placeToDraft(stored), stored)).toBe(true);
  });

  it('detects name, coordinate and hierarchy changes', () => {
    const stored = place();
    const base = placeToDraft(stored);
    expect(placeDraftMatches({ ...base, latitude: '54.2' }, stored)).toBe(false);
    expect(
      placeDraftMatches({ ...base, names: [{ ...emptyPlaceNameDraft(0), id: 'N1', value: 'Kaluga' }] }, stored),
    ).toBe(false);
    expect(
      placeDraftMatches({ ...base, hierarchy: [{ id: 'H1', parentId: 'PL2', type: '', date: emptyDate() }] }, stored),
    ).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import type { PlaceRecord } from '@doru/core';
import { emptyDate } from '@doru/ui/domain';
import {
  emptyPlaceDraft,
  placeDraftMatches,
  placeDraftName,
  placeDraftToRecord,
  placeToDraft,
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
      names: [
        { id: 'N1', kind: 'official', position: 0, value: 'Tula' },
        { id: 'N2', kind: 'official', position: 1, value: 'Tula Oblast' },
        { id: 'N3', kind: 'translation', language: 'en', position: 0, value: 'Tula' },
      ],
      hierarchy: [{ parentId: 'PL2', type: 'poli' }],
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
      hierarchy: [{ parentId: 'PL2', type: 'poli' }],
    });
    expect(draft.names).toHaveLength(3);
    expect(draft.names[1]).toMatchObject({ id: 'N2', kind: 'official', value: 'Tula Oblast' });
    expect(draft.postalCodes[0]).toMatchObject({ id: 'PC1', code: '300000', date: { ...emptyDate(), year: '1930' } });
    expect(placeDraftToRecord(draft)).toEqual(stored);
  });

  it('drops empty names, links and postal codes; parses coordinates', () => {
    const record = placeDraftToRecord({
      ...emptyPlaceDraft(),
      latitude: '54.19',
      longitude: 'abc',
      names: [{ id: 'N1', kind: 'official', language: '', type: '', position: 0, value: '  Tula  ' }],
      postalCodes: [{ id: 'PC1', code: '  ', date: emptyDate() }],
      hierarchy: [{ parentId: '', type: '' }],
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
      placeDraftMatches(
        { ...base, names: [{ id: 'N1', kind: 'official', language: '', type: '', position: 0, value: 'Kaluga' }] },
        stored,
      ),
    ).toBe(false);
    expect(placeDraftMatches({ ...base, hierarchy: [{ parentId: 'PL2', type: '' }] }, stored)).toBe(false);
  });
});

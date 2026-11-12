import { describe, expect, it } from 'vitest';
import {
  addressDraftEmpty,
  addressDraftToRecord,
  addressLabel,
  addressToDraft,
  emptyAddressDraft,
} from '../src/domain/registries/address';

describe('address draft helpers', () => {
  it('round-trips an address record', () => {
    const stored = {
      id: 'A1',
      lines: ['State Archive', 'Building 3'],
      city: 'Tula',
      state: 'Tula Oblast',
      postalCode: '300000',
      country: 'Russia',
    };
    const draft = addressToDraft(stored);
    expect(draft).toEqual({
      id: 'A1',
      lines: ['State Archive', 'Building 3'],
      city: 'Tula',
      state: 'Tula Oblast',
      postalCode: '300000',
      country: 'Russia',
    });
    expect(addressDraftToRecord(draft)).toEqual(stored);
  });

  it('drops empty lines and fields; keeps at least one empty line in the draft', () => {
    const draft = emptyAddressDraft();
    expect(draft.lines).toEqual(['']);
    const record = addressDraftToRecord({
      ...draft,
      lines: ['  Main street ', '   ', 'Second line'],
      city: '  Tula ',
    });
    expect(record.lines).toEqual(['Main street', 'Second line']);
    expect(record.city).toBe('Tula');
    expect(record.state).toBeUndefined();
  });

  it('detects emptiness', () => {
    expect(addressDraftEmpty(emptyAddressDraft())).toBe(true);
    expect(addressDraftEmpty({ ...emptyAddressDraft(), city: 'Tula' })).toBe(false);
    expect(addressDraftEmpty({ ...emptyAddressDraft(), lines: ['x'] })).toBe(false);
  });

  it('formats the display label', () => {
    expect(
      addressLabel({
        id: 'A1',
        lines: ['Building 3'],
        city: 'Tula',
        postalCode: '300000',
        country: 'Russia',
      }),
    ).toBe('Building 3, Tula 300000, Russia');
    expect(addressLabel(undefined)).toBe('');
  });
});

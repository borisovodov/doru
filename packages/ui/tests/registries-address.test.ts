import { describe, expect, it } from 'vitest';
import {
  addressDraftEmpty,
  addressDraftToRecord,
  addressLabel,
  addressToDraft,
  emptyAddressDraft,
} from '../src/domain/registries/address';

describe('address draft helpers', () => {
  it('round-trips an address record and keeps line ids stable', () => {
    const stored = {
      id: 'A1',
      lines: [
        { id: 'L1', value: 'State Archive' },
        { id: 'L2', value: 'Building 3' },
      ],
      city: 'Tula',
      state: 'Tula Oblast',
      postalCode: '300000',
      country: 'Russia',
    };
    const draft = addressToDraft(stored);
    expect(draft).toEqual({
      id: 'A1',
      lines: [
        { id: 'L1', value: 'State Archive' },
        { id: 'L2', value: 'Building 3' },
      ],
      city: 'Tula',
      state: 'Tula Oblast',
      postalCode: '300000',
      country: 'Russia',
    });
    expect(addressDraftToRecord(draft)).toEqual(stored);
  });

  it('drops empty lines and fields; keeps at least one empty line in the draft', () => {
    const draft = emptyAddressDraft();
    expect(draft.lines).toEqual([{ id: undefined, value: '' }]);
    const record = addressDraftToRecord({
      ...draft,
      lines: [
        { id: 'L1', value: '  Main street ' },
        { id: undefined, value: '   ' },
        { id: 'L2', value: 'Second line' },
      ],
      city: '  Tula ',
    });
    expect(record.lines).toEqual([
      { id: 'L1', value: 'Main street' },
      { id: 'L2', value: 'Second line' },
    ]);
    expect(record.city).toBe('Tula');
    expect(record.state).toBeUndefined();
  });

  it('detects emptiness', () => {
    expect(addressDraftEmpty(emptyAddressDraft())).toBe(true);
    expect(addressDraftEmpty({ ...emptyAddressDraft(), city: 'Tula' })).toBe(false);
    expect(addressDraftEmpty({ ...emptyAddressDraft(), lines: [{ id: undefined, value: 'x' }] })).toBe(false);
  });

  it('formats the display label', () => {
    expect(
      addressLabel({
        id: 'A1',
        lines: [{ id: 'L1', value: 'Building 3' }],
        city: 'Tula',
        postalCode: '300000',
        country: 'Russia',
      }),
    ).toBe('Building 3, Tula 300000, Russia');
    expect(addressLabel(undefined)).toBe('');
  });
});

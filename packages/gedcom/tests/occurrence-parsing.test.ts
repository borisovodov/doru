import { describe, expect, test } from 'vitest';
import { parseGedcom70 } from '../src/parsing/assemble';
import type { GedcomDataset } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parseOk(text: string | string[]): GedcomDataset {
  const source = Array.isArray(text) ? text.join('\n') : text;
  const result = parseGedcom70(enc(source));
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

const HEADER = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 SUBM @U1@', '0 @U1@ SUBM'];

describe('occurrence records', () => {
  test('parses an _OCUR record with every child', () => {
    const dataset = parseOk([
      ...HEADER,
      '0 @O1@ _OCUR',
      '1 TYPE death',
      '1 DATE 12 MAR 1990',
      '1 PLAC Moscow, Russia',
      '1 CAUS illness',
      '1 AGNC the registry',
      '1 RELI orthodox',
      '1 _PART @I1@',
      '2 ROLE witness',
      '2 AGE 34y',
      '2 NOTE a participant note',
      '2 SOUR @S1@',
      '1 _ATTR key',
      '2 _VALUE val',
      '2 NOTE an attribute note',
      '1 NOTE a note',
      '1 SOUR @S1@',
      '1 OBJE @M1@',
      '1 UID gramps-handle',
      '1 CHAN',
      '2 DATE 1 JAN 2026',
      '0 @I1@ INDI',
      '0 @S1@ SOUR',
      '0 @M1@ OBJE',
      '0 TRLR',
    ]);
    const record = dataset.records.find((entry) => entry.tag === '_OCUR');
    expect(record).toMatchObject({
      xref: '@O1@',
      type: 'death',
      cause: 'illness',
      agency: 'the registry',
      religion: 'orthodox',
      uids: ['gramps-handle'],
      participants: [
        {
          tag: '_PART',
          individual: '@I1@',
          role: 'witness',
        },
      ],
      attributes: [{ tag: '_ATTR', payload: 'key', value: 'val' }],
    });
    expect(record).toHaveProperty('date');
    expect(record).toHaveProperty('place');
    expect(record).toHaveProperty('changeDate');
    expect(record).toHaveProperty('notes');
    expect(record).toHaveProperty('citations');
    expect(record).toHaveProperty('media');
  });

  test('parses a bare _OCUR record', () => {
    const dataset = parseOk([...HEADER, '0 @O2@ _OCUR', '0 TRLR']);
    const record = dataset.records.find((entry) => entry.tag === '_OCUR');
    expect(record).toEqual({ tag: '_OCUR', xref: '@O2@' });
  });
});

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

function parseFail(text: string): string {
  const result = parseGedcom70(enc(text));
  if (result.ok) {
    throw new Error('expected a parse failure');
  }
  return result.error.message;
}

const HEADER = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 SUBM @U1@', '0 @U1@ SUBM'];

describe('name structure vendor fields', () => {
  test('parses the name-level vendor spellings', () => {
    const dataset = parseOk([
      ...HEADER,
      '0 @I1@ INDI',
      '1 NAME Ivan /Petrov/',
      '2 MIDDLE Thomas',
      '2 _PGVN Esther',
      '2 _PATN Ivanovich',
      '2 CREA not a date',
      '2 _CRE',
      '3 DATE 2026',
      '2 NPFX Dr.',
      '3 _XTRN odd',
      '2 _EVID not a pointer',
      '2 _OBJE @M1@',
      '2 TRAN Иван',
      '3 LANG ru',
      '3 NOTE a translation note',
      '2 FONE Eevan',
      '3 TYPE phonetic-type',
      '3 NOTE a phonetic note',
      '2 ROMN Ivan',
      '3 NOTE a romanized note',
      '2 NOTE a name note',
      '0 @M1@ OBJE',
      '0 TRLR',
    ]);
    const individual = dataset.records.find((entry) => entry.tag === 'INDI');
    const name = individual.names[0];
    expect(name).toMatchObject({
      middleName: 'Thomas',
      givenNameUsed: 'Esther',
      patronymic: 'Ivanovich',
      creationDate: expect.anything(),
      translations: [{ payload: { given: 'Иван' }, language: 'ru' }],
      phonetic: [{ payload: { given: 'Eevan' }, type: 'phonetic-type' }],
      romanized: [{ payload: { given: 'Ivan' } }],
      notes: [expect.objectContaining({ payload: 'a name note' })],
      media: [expect.objectContaining({ tag: 'OBJE' })],
      pieces: { namePrefixes: ['Dr.'] },
      extensions: expect.arrayContaining([
        expect.objectContaining({ tag: '_EVID', payload: 'not a pointer' }),
        expect.objectContaining({ tag: 'CREA', payload: 'not a date' }),
      ]),
    });
  });
});

describe('place structure vendor fields', () => {
  test('parses MAP text form, postal codes and place variants', () => {
    const dataset = parseOk([
      ...HEADER,
      '0 @I1@ INDI',
      '1 BIRT',
      '2 PLAC Moscow, Russia',
      '3 MAP Moscow',
      '4 TYPE MAIDENHEAD',
      '4 NOTE a map note',
      '3 _POST 101000',
      '4 DATE 2020',
      '4 SOUR @S1@',
      '3 TRAN Москва',
      '4 LANG ru',
      '3 FONE moskva',
      '4 TYPE phonetic',
      '4 _XTRN odd',
      '3 ROMN moskva',
      '4 TYPE romanized',
      '3 _COR',
      '4 _LAD 55',
      '4 _LAM 45',
      '4 _LAS 20.88',
      '4 _LAN N',
      '4 _LOD 37',
      '4 _LOM 37',
      '4 _LOS 2.8',
      '4 _LON E',
      '4 _XTRN odd',
      '3 FORM City, Country',
      '0 @S1@ SOUR',
      '0 TRLR',
    ]);
    const individual = dataset.records.find((entry) => entry.tag === 'INDI');
    const place = individual.events[0].detail.place;
    expect(place).toMatchObject({
      payload: ['Moscow', 'Russia'],
      form: ['City', 'Country'],
      maidenhead: 'Moscow',
      postalCodes: [{ code: '101000', date: expect.anything(), citations: expect.arrayContaining([expect.objectContaining({ tag: 'SOUR' })]) }],
      translations: [{ payload: ['Москва'], language: 'ru' }],
      phonetic: [{ payload: ['moskva'], type: 'phonetic' }],
      romanized: [{ payload: ['moskva'], type: 'romanized' }],
      map: {
        latitude: { direction: 'N', degrees: expect.closeTo(55.7558) },
        longitude: { direction: 'E', degrees: expect.closeTo(37.6174) },
      },
      extensions: expect.arrayContaining([expect.objectContaining({ tag: '_XTRN' })]),
    });
  });

  test('requires LATI and LONG in the MAP structure', () => {
    expect(
      parseFail([...HEADER, '0 @I1@ INDI', '1 BIRT', '2 PLAC Moscow', '3 MAP', '4 LATI 55', '0 TRLR'].join('\n')),
    ).toContain('requires LATI and LONG');
  });

  test('rejects an invalid MAP TYPE', () => {
    expect(
      parseFail([...HEADER, '0 @I1@ INDI', '1 BIRT', '2 PLAC Moscow', '3 MAP Moscow', '4 TYPE WRONG', '0 TRLR'].join('\n')),
    ).toContain('must be MAIDENHEAD');
  });

  test('rejects malformed _COR coordinate blocks', () => {
    expect(
      parseFail([...HEADER, '0 @I1@ INDI', '1 BIRT', '2 PLAC Moscow', '3 _COR', '4 _LAM 1', '0 TRLR'].join('\n')),
    ).toContain('requires the _LAD substructure');
    expect(
      parseFail([...HEADER, '0 @I1@ INDI', '1 BIRT', '2 PLAC Moscow', '3 _COR', '4 _LAD x', '4 _LOD 1', '0 TRLR'].join('\n')),
    ).toContain('Invalid _LAD');
    expect(
      parseFail([...HEADER, '0 @I1@ INDI', '1 BIRT', '2 PLAC Moscow', '3 _COR', '4 _LAD 91', '4 _LOD 1', '0 TRLR'].join('\n')),
    ).toContain('beyond 90 degrees');
    expect(
      parseFail([...HEADER, '0 @I1@ INDI', '1 BIRT', '2 PLAC Moscow', '3 _COR', '4 _LAD 1', '4 _LAN X', '4 _LOD 1', '0 TRLR'].join('\n')),
    ).toContain('must be N, S, E or W');
  });
});

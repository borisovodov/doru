import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset, IndividualRecord } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

/** The serializers emit CRLF line endings. */
const lines = (text: string): string[] => text.split('\r\n');

function parseOk551(text: string): GedcomDataset {
  const result = parseGedcom551(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function parseOk70(text: string): GedcomDataset {
  const result = parseGedcom70(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function err70(text: string): string {
  const result = parseGedcom70(enc(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
}

function ser551(dataset: GedcomDataset): string {
  const result = serializeGedcom551(dataset);
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function ser70(dataset: GedcomDataset): string {
  const result = serializeGedcom70(dataset);
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

const H551 = ['0 HEAD', '1 SOUR X', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
const SUBM = ['0 @S1@ SUBM', '1 NAME T'];
const H70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0'];

function indi551(lines: string[]): string {
  return [...H551, '0 @I1@ INDI', ...lines, ...SUBM, '0 TRLR'].join('\n');
}

function indi70(lines: string[]): string {
  return [...H70, '0 @I1@ INDI', ...lines, '0 TRLR'].join('\n');
}

function indi(dataset: GedcomDataset): IndividualRecord {
  const record = dataset.records.find((entry) => entry.tag === 'INDI');
  if (record === undefined || record.tag !== 'INDI') {
    throw new Error('expected INDI');
  }
  return record;
}

describe('the Mac Family Tree 7/8, Der Stammbaum ≤V6 and RootsMagic non-underscore tags (GenWiki Tabelle 2)', () => {
  const MFT_SAMPLE = [
    '1 DEED Kaufvertrag',
    '1 MISE x',
    '1 MRCI',
    '2 DATE 12 JUN 1910',
    '1 MRRE',
    '1 PRIV',
    '1 RECT 12,34,56,78',
    '1 BIRT',
    '2 BTYP 2',
    '1 BURI',
    '2 AGED 80',
    '1 NCHI 3',
    '2 SURE 1',
    '1 NAME John /Doe/',
    '2 SECG Johann',
    '1 NAME_ Variant',
    '1 FSFTID KWJ1-2B3',
  ];

  test('accepts the tags as generic extensions on 5.5.1 input and round-trips them', () => {
    const dataset = parseOk551(indi551(MFT_SAMPLE));
    const person = indi(dataset);
    const extensionTags = (person.extensions ?? []).map((entry) => entry.tag);
    expect(extensionTags).toEqual(
      expect.arrayContaining(['DEED', 'MISE', 'MRCI', 'MRRE', 'PRIV', 'RECT', 'NAME_']),
    );
    // The children under a generic extension survive verbatim too.
    const mrci = person.extensions?.find((entry) => entry.tag === 'MRCI');
    expect(mrci?.children).toEqual([{ tag: 'DATE', payload: '12 JUN 1910', children: [] }]);
    const birth = person.events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.extensions?.map((entry) => entry.tag)).toEqual(['BTYP']);
    const burial = person.events?.find((entry) => entry.tag === 'BURI');
    expect(burial?.extensions?.map((entry) => entry.tag)).toEqual(['AGED']);
    const nchi = person.attributes?.find((entry) => entry.tag === 'NCHI');
    expect(nchi?.extensions?.map((entry) => entry.tag)).toEqual(['SURE']);
    // SECG under NAME stays with its position.
    const name = person.names?.[0];
    expect(name?.extensions?.map((entry) => entry.tag)).toEqual(['SECG']);
    // The 5.5.1 round trip preserves everything verbatim.
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });

  test('the FAM-level USM6 SURE under NCHI is accepted too', () => {
    const text = [
      ...H551,
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 NCHI 3',
      '2 SURE 1',
      '0 @I1@ INDI',
      ...SUBM,
      '0 TRLR',
    ].join('\n');
    const dataset = parseOk551(text);
    const fam = dataset.records.find((entry) => entry.tag === 'FAM');
    expect(fam?.tag === 'FAM' ? fam.attributes?.[0]?.extensions?.map((entry) => entry.tag) : undefined).toEqual(['SURE']);
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });

  test('the USM6 header settings blocks are accepted', () => {
    const text = [
      '0 HEAD',
      '1 SOUR X',
      '1 SUBM @S1@',
      '1 GEDC',
      '2 VERS 5.5.1',
      '2 FORM LINEAGE-LINKED',
      '1 CHAR UTF-8',
      '1 FPRF',
      '2 INDI',
      '1 MPRF',
      '0 @S1@ SUBM',
      '1 NAME T',
      '0 TRLR',
    ].join('\n');
    const dataset = parseOk551(text);
    expect(dataset.header.extensions?.map((entry) => entry.tag)).toEqual(['FPRF', 'MPRF']);
  });

  test('the RootsMagic FSFTID spelling types into familySearchId', () => {
    const dataset = parseOk551(indi551(['1 FSFTID KWJ1-2B3']));
    expect(indi(dataset).familySearchId).toBe('KWJ1-2B3');
    // Standard-first export: the canonical _FSFTID spelling.
    expect(lines(ser551(dataset))).toContain('1 _FSFTID KWJ1-2B3');
    expect(lines(ser70(dataset))).toContain('1 _FSFTID KWJ1-2B3');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });

  test('the generic tail is dropped on 7.0 export and stays strict on 7.0 input', () => {
    const dataset = parseOk551(indi551(MFT_SAMPLE));
    const text = ser70(dataset);
    for (const tag of ['DEED', 'MISE', 'MRCI', 'MRRE', 'PRIV', 'RECT', 'BTYP', 'AGED', 'SURE', 'SECG', 'NAME_']) {
      expect(text, tag).not.toContain(tag);
    }
    for (const tag of ['DEED', 'MISE', 'MRCI', 'MRRE', 'PRIV', 'RECT', 'BTYP', 'AGED', 'SURE', 'SECG', 'NAME_']) {
      expect(err70(indi70([`1 ${tag} x`])), tag).toBe('structure.unknown-tag');
    }
  });

  test('unknown non-underscore tags remain strict errors on 5.5.1 input', () => {
    const result = parseGedcom551(enc(indi551(['1 NOTATAG x'])));
    if (result.ok) {
      throw new Error('expected an error');
    }
    expect((result.error as { code: string }).code).toBe('structure.unknown-tag');
  });
});

describe('the GenWiki twins of the typed vendor tags', () => {
  const TWIN_SAMPLE = [
    '1 _FID KWJ1-2B3',
    '1 _AHNNR 42',
    '1 _CREAT 18 FEB 2015',
    '1 _HEIRATNAME Anna /Schmidt/',
    '1 _CALL Johnny',
    '1 _FRKA John /Smith/',
    '1 _HNM Yitzhak /Cohen/',
    '1 _INDG Little /Bear/',
    '1 _LNCH Jane /Roe/',
    '1 BIRT',
    '2 _PRI',
    '2 _EVN 12',
    '1 CHAN',
    '2 DATE 1 JAN 2020',
    '2 _WT_USER boris',
    '0 @M1@ OBJE',
    '1 FILE photo.jpg',
    '2 FORM jpg',
    '2 _CTYP person',
    '0 @F1@ FAM',
    '1 HUSB @I1@',
    '1 _MARI',
    '2 DATE 1910',
  ];

  test('types every twin into the model', () => {
    const dataset = parseOk551([...H551, '0 @I1@ INDI', ...TWIN_SAMPLE, ...SUBM, '0 TRLR'].join('\n'));
    const person = indi(dataset);
    expect(person.familySearchId).toBe('KWJ1-2B3');
    expect(person.sosaNumber).toBe('42');
    expect(person.createdAt).toBe('18 FEB 2015');
    expect(person.names?.map((name) => name.type?.payload)).toEqual([
      'MARRIED',
      'OTHER',
      'OTHER',
      'OTHER',
      'OTHER',
      'OTHER',
    ]);
    expect(person.names?.map((name) => name.type?.phrase)).toEqual([
      undefined,
      'Called name',
      'Formerly known as',
      'Hebrew name',
      'Indigenous name',
      'Legal name change',
    ]);
    const birth = person.events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.primary).toBe(true);
    expect(birth?.detail?.eventNumber).toBe('12');
    expect(person.changeDate?.user).toBe('boris');
    const media = dataset.records.find((entry) => entry.tag === 'OBJE');
    if (media === undefined || media.tag !== 'OBJE') {
      throw new Error('expected OBJE');
    }
    expect(media.files?.[0]?.contentType).toBe('person');
    const fam = dataset.records.find((entry) => entry.tag === 'FAM');
    const mari = fam?.tag === 'FAM' ? fam.events?.find((entry) => entry.tag === 'EVEN') : undefined;
    expect(mari?.type).toBe('Marriage intention');
    expect(mari?.detail?.detail?.date?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', year: 1910 });
  });

  test('5.5.1 writes the twins back and round-trips them', () => {
    const first = parseOk551([...H551, '0 @I1@ INDI', ...TWIN_SAMPLE, ...SUBM, '0 TRLR'].join('\n'));
    const text = ser551(first);
    expect(lines(text)).toContain('1 _FSFTID KWJ1-2B3'); // _FID canonicalized
    expect(lines(text)).toContain('1 _SOSA 42'); // _AHNNR canonicalized
    expect(lines(text)).toContain('1 _CREAT 18 FEB 2015');
    expect(lines(text)).toContain('2 TYPE married'); // _HEIRATNAME
    expect(lines(text)).toContain('2 TYPE Called name');
    expect(lines(text)).toContain('2 TYPE Formerly known as');
    expect(lines(text)).toContain('2 TYPE Hebrew name');
    expect(lines(text)).toContain('2 TYPE Indigenous name');
    expect(lines(text)).toContain('2 TYPE Legal name change');
    expect(lines(text)).toContain('2 _PRI');
    expect(lines(text)).toContain('2 _EVN 12');
    expect(lines(text)).toContain('2 _WT_USER boris');
    expect(lines(text)).toContain('2 _CTYP person');
    expect(lines(text)).toContain('1 EVEN');
    expect(lines(text)).toContain('2 TYPE Marriage intention');
    expect(parseOk551(text)).toEqual(first);
  });

  test('7.0 keeps the twin values too', () => {
    const parsed70 = parseOk70(ser70(parseOk551([...H551, '0 @I1@ INDI', ...TWIN_SAMPLE, ...SUBM, '0 TRLR'].join('\n'))));
    const person = indi(parsed70);
    expect(person.familySearchId).toBe('KWJ1-2B3');
    expect(person.sosaNumber).toBe('42');
    expect(person.createdAt).toBe('18 FEB 2015');
    const nameTypes = person.names?.map((name) => ({ type: name.type?.payload, phrase: name.type?.phrase }));
    expect(nameTypes).toEqual([
      { type: 'MARRIED', phrase: undefined },
      { type: 'OTHER', phrase: 'Called name' },
      { type: 'OTHER', phrase: 'Formerly known as' },
      { type: 'OTHER', phrase: 'Hebrew name' },
      { type: 'OTHER', phrase: 'Indigenous name' },
      { type: 'OTHER', phrase: 'Legal name change' },
    ]);
    const birth = person.events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.primary).toBe(true);
    expect(birth?.detail?.eventNumber).toBe('12');
    expect(person.changeDate?.user).toBe('boris');
    const media = parsed70.records.find((entry) => entry.tag === 'OBJE');
    expect(media?.tag === 'OBJE' ? media.files?.[0]?.contentType : undefined).toBe('person');
    // The 7.0-to-7.0 round trip is idempotent.
    expect(parseOk70(ser70(parsed70))).toEqual(parsed70);
  });
});

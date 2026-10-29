import { describe, expect, test } from 'vitest';
import { parse } from '../src/detect';
import { parseGedcom551 } from '../src/parsing/assemble';
import {
  serializeGedcom551,
  serializeGedcom70,
} from '../src/serialize/serialize';
import type {
  GedcomDataset,
  IndividualRecord,
} from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parse551(text: string): GedcomDataset {
  const result = parseGedcom551(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function err551(text: string): string {
  const result = parseGedcom551(enc(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
}

// The 5.5.5 vocabulary is accepted in any 5.x file, regardless of the
// declared GEDC.VERS; the container stays the 5.5.1 pipeline.
const HEADER551 = ['0 HEAD', '1 SOUR DORU', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
const HEADER555 = ['0 HEAD', '1 SOUR DORU', '1 GEDC', '2 VERS 5.5.5', '2 FORM LINEAGE-LINKED', '3 VERS 5.5.5', '1 CHAR UTF-8'];
const SUBM = ['0 @S1@ SUBM', '1 NAME Tester'];

describe('the 5.5.5 vocabulary over the 5.5.1 pipeline', () => {
  test('a file declaring VERS 5.5.5 parses under the 5.5.1 rules', () => {
    const dataset = parse551([...HEADER555, '0 @I1@ INDI', '1 NAME Test /One/', '0 TRLR'].join('\n'));
    expect(dataset.header.gedcom.version).toBe('5.5.5');
    expect(dataset.header.gedcom.form).toBe('LINEAGE-LINKED');
    expect(dataset.header.gedcom).not.toHaveProperty('formVersion'); // tolerated, not stored
    expect(dataset.header.submitter).toBeUndefined(); // no SUBM-pointer requirement for 5.5.5 files
  });

  test('the unified parse reports 5.5.1 for a 5.5.5 file', () => {
    const result = parse(enc([...HEADER555, ...SUBM, '0 TRLR'].join('\n')));
    expect(result.ok).toBe(true);
    if (result.ok && result.value.kind === 'dataset') {
      expect(result.value.version).toBe('5.5.1');
    } else {
      throw new Error('expected a dataset');
    }
  });

  test('SEX X and SEX N are accepted in a 5.5.1 file (GEDCOM 5.5.5 p.104)', () => {
    const dataset = parse551(
      [
        ...HEADER551,
        '0 @I1@ INDI',
        '1 NAME Test /One/',
        '1 SEX X',
        '0 @I2@ INDI',
        '1 NAME Test /Two/',
        '1 SEX N',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const individuals = dataset.records.filter((record): record is IndividualRecord => record.tag === 'INDI');
    expect(individuals[0]?.sex).toBe('X');
    expect(individuals[1]?.sex).toBe('N');
  });

  test('the BCE and BC epoch spellings are accepted on year-only dates (GEDCOM 5.5.5 p.77)', () => {
    const dataset = parse551(
      [...HEADER551, '0 @I1@ INDI', '1 NAME Test /One/', '1 BIRT', '2 DATE 100 BCE', '1 DEAT', '2 DATE 50 BC', ...SUBM, '0 TRLR'].join('\n'),
    );
    const individual = dataset.records[0] as IndividualRecord;
    expect(individual.events?.[0]?.detail?.date?.value).toEqual({
      kind: 'date',
      calendar: 'GREGORIAN',
      year: 100,
      epoch: 'BCE',
    });
    expect(individual.events?.[1]?.detail?.date?.value).toEqual({
      kind: 'date',
      calendar: 'GREGORIAN',
      year: 50,
      epoch: 'BCE',
    });
  });

  test('the BCE suffix stays restricted to the year-only form (GEDCOM 5.5.5 p.83)', () => {
    expect(err551([...HEADER551, '0 @I1@ INDI', '1 NAME T /X/', '1 BIRT', '2 DATE 1 JAN 100 BCE', ...SUBM, '0 TRLR'].join('\n'))).toBe(
      'date.bad-epoch',
    );
  });

  test('a year-less day+month date is accepted (GEDCOM 5.5.5 p.83)', () => {
    const dataset = parse551(
      [...HEADER551, '0 @I1@ INDI', '1 NAME Test /One/', '1 BIRT', '2 DATE 25 DEC', ...SUBM, '0 TRLR'].join('\n'),
    );
    const individual = dataset.records[0] as IndividualRecord;
    expect(individual.events?.[0]?.detail?.date?.value).toEqual({
      kind: 'date',
      calendar: 'GREGORIAN',
      day: 25,
      month: 'DEC',
    });
  });

  test('a year-less date outside the Gregorian calendar is rejected', () => {
    expect(err551([...HEADER551, '0 @I1@ INDI', '1 NAME T /X/', '1 BIRT', '2 DATE @#DJULIAN@ 25 DEC', ...SUBM, '0 TRLR'].join('\n'))).toBe(
      'date.invalid',
    );
  });

  test('the 5.5.1 ∪ 5.5.5 media format sets are accepted, OLE included (GEDCOM 5.5.5 p.94)', () => {
    const dataset = parse551(
      [
        ...HEADER551,
        '0 @O1@ OBJE',
        '1 FILE photo.jpeg',
        '2 FORM JPEG',
        '0 @O2@ OBJE',
        '1 FILE scan.tiff',
        '2 FORM TIFF',
        '0 @O3@ OBJE',
        '1 FILE old.ole',
        '2 FORM OLE',
        '0 @O4@ OBJE',
        '1 FILE doc.pdf',
        '2 FORM pdf',
        '0 @O5@ OBJE',
        '1 FILE song.mp3',
        '2 FORM MP3',
        '0 @O6@ OBJE',
        '1 FILE book.epub',
        '2 FORM ePub',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const files = dataset.records.filter((record) => record.tag === 'OBJE');
    expect(files[0]).toMatchObject({ files: [{ form: { payload: 'jpeg' } }] });
    expect(files[1]).toMatchObject({ files: [{ form: { payload: 'tiff' } }] });
    expect(files[2]).toMatchObject({ files: [{ form: { payload: 'ole' } }] });
    expect(files[3]).toMatchObject({ files: [{ form: { payload: 'pdf' } }] });
    expect(files[4]).toMatchObject({ files: [{ form: { payload: 'mp3' } }] });
    expect(files[5]).toMatchObject({ files: [{ form: { payload: 'epub' } }] });
    expect(err551([...HEADER551, '0 @O7@ OBJE', '1 FILE x.exe', '2 FORM exe', ...SUBM, '0 TRLR'].join('\n'))).toBe('enum.invalid-value');
  });

  test('GEDC.FORM.VERS is tolerated and discarded (GEDCOM 5.5.5 §1 p.49)', () => {
    const dataset = parse551([...HEADER555, ...SUBM, '0 TRLR'].join('\n'));
    expect(dataset.header.gedcom).not.toHaveProperty('formVersion');
    // Two VERS under FORM is still a cardinality error.
    const doubled = [
      '0 HEAD',
      '1 SOUR DORU',
      '1 GEDC',
      '2 VERS 5.5.5',
      '2 FORM LINEAGE-LINKED',
      '3 VERS 5.5.5',
      '3 VERS 5.5.5',
      '1 CHAR UTF-8',
      ...SUBM,
      '0 TRLR',
    ].join('\n');
    expect(err551(doubled)).toBe('structure.cardinality');
  });

  test('a 5.5.5 file needs no byte-order mark (5.5.1 container rules apply)', () => {
    expect(parse551([...HEADER555, ...SUBM, '0 TRLR'].join('\n')).header.gedcom.version).toBe('5.5.5');
  });

  test('the 5.5.5 structured ADDR without a line value parses (5.5.5 §2 p.104)', () => {
    const dataset = parse551(
      [
        ...HEADER555,
        '0 @R1@ REPO',
        '1 NAME Archive',
        '1 ADDR',
        '2 ADR1 Main Street 1',
        '2 CITY Musterstadt',
        '2 POST 12345',
        '2 CTRY Germany',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const repo = dataset.records.find((record) => record.tag === 'REPO');
    expect(repo && 'address' in repo && repo.address).toMatchObject({
      line1: 'Main Street 1',
      city: 'Musterstadt',
      postalCode: '12345',
      country: 'Germany',
    });
    // The serializer synthesizes the required ADDR payload from the
    // structured parts for both target versions (the payload is a
    // projection: a reparse keeps it alongside the structured parts).
    const result = serializeGedcom551(dataset);
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    const text = result.value;
    expect(text).toContain('1 ADDR Main Street 1, Musterstadt, 12345, Germany');
    const reparsed = parse551(text);
    const repo2 = reparsed.records.find((record) => record.tag === 'REPO');
    expect(repo2 && 'address' in repo2 && repo2.address?.payload).toBe('Main Street 1, Musterstadt, 12345, Germany');
    const result70 = serializeGedcom70(dataset);
    if (!result70.ok) {
      throw new Error(JSON.stringify(result70));
    }
    expect(result70.value).toContain('1 ADDR Main Street 1, Musterstadt, 12345, Germany');
  });
});

describe('the 5.5.5 vocabulary on export', () => {
  const SOURCE = [
    ...HEADER551,
    '0 @I1@ INDI',
    '1 NAME Test /One/',
    '1 SEX X',
    '1 BIRT',
    '2 DATE 100 BCE',
    '1 DEAT',
    '2 DATE 25 DEC',
    '0 @I2@ INDI',
    '1 NAME Test /Two/',
    '1 SEX N',
    ...SUBM,
    '0 TRLR',
  ].join('\n');

  test('5.5.1 output projects SEX X/N, BCE and the year-less date', () => {
    const dataset = parse551(SOURCE);
    const serialized = serializeGedcom551(dataset);
    expect(serialized.ok).toBe(true);
    if (!serialized.ok) {
      return;
    }
    expect(serialized.value).not.toContain('1 SEX X');
    expect(serialized.value).not.toContain('1 SEX N');
    expect(serialized.value).toContain('2 DATE 100 B.C.');
    expect(serialized.value).not.toContain('2 DATE 25 DEC'); // year-less: dropped
    expect(parseGedcom551(enc(serialized.value)).ok).toBe(true);
  });

  test('a 5.5.5 media format is dropped on 5.5.1 output (not in the fixed set)', () => {
    const dataset = parse551(
      [...HEADER551, '0 @O1@ OBJE', '1 FILE photo.jpeg', '2 FORM JPEG', ...SUBM, '0 TRLR'].join('\n'),
    );
    const serialized = serializeGedcom551(dataset);
    expect(serialized.ok).toBe(true);
    if (!serialized.ok) {
      return;
    }
    expect(serialized.value).not.toContain('2 FORM JPEG');
  });

  test('7.0 output keeps SEX X, drops SEX N and the year-less date', () => {
    const dataset = parse551(SOURCE);
    const serialized = serializeGedcom70(dataset);
    expect(serialized.ok).toBe(true);
    if (!serialized.ok) {
      return;
    }
    expect(serialized.value).toContain('1 SEX X');
    expect(serialized.value).not.toContain('1 SEX N');
    expect(serialized.value).not.toContain('25 DEC');
    expect(serialized.value).toContain('DATE 100 BCE');
  });
});

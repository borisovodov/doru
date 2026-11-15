import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parse70(text: string): GedcomDataset {
  const result = parseGedcom70(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function parse551(text: string): GedcomDataset {
  const result = parseGedcom551(enc(text));
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

function ser551(dataset: GedcomDataset): string {
  const result = serializeGedcom551(dataset);
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

const H70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0'];
const H551 = ['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
const SUBM = ['0 @S1@ SUBM', '1 NAME Tester'];

function to551(dataset: GedcomDataset): void {
  const header = dataset.header;
  header.source = { payload: 'MyApp' };
  header.submitter = '@S1@';
  header.gedcom.form = 'LINEAGE-LINKED';
  header.gedcom.version = '5.5.1';
  dataset.records.push({ tag: 'SUBM', name: 'T' });
}

describe('name and place translations across versions', () => {
  test('7.0 romanized variations translate with a known method', () => {
    const dataset = parse551(
      [...H551, '0 @I1@ INDI', '1 NAME John /Doe/', '2 ROMN Dzon /Doe/', '3 TYPE romaji', ...SUBM, '0 TRLR'].join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('2 TRAN Dzon/Doe/');
    expect(text).toContain('3 LANG ja-Latn');
  });

  test('5.5.1 translates a hangul name into FONE', () => {
    const dataset = parse70(
      H70.concat('0 @I1@ INDI', '1 NAME John /Doe/', '2 TRAN 존 /도/', '3 LANG ko-Hang', '0 TRLR').join('\n'),
    );
    to551(dataset);
    const text = ser551(dataset);
    expect(text).toContain('2 FONE 존/도/');
    expect(text).toContain('3 TYPE hangul');
  });

  test('5.5.1 translates a place with a known method', () => {
    const dataset = parse70(
      H70.concat(
        '0 @I1@ INDI',
        '1 BIRT',
        '2 PLAC Berlin',
        '3 TRAN Berurin',
        '4 LANG ja-Kana',
        '3 TRAN Берлин',
        '4 LANG ja-Latn',
        '0 TRLR',
      ).join('\n'),
    );
    to551(dataset);
    const text = ser551(dataset);
    expect(text).toContain('3 FONE Berurin');
    expect(text).toContain('4 TYPE kana');
    expect(text).toContain('3 ROMN Берлин');
    expect(text).toContain('4 TYPE romaji');
  });

  test('5.5.1 drops place translations with unknown languages', () => {
    const dataset = parse70(
      H70.concat('0 @I1@ INDI', '1 BIRT', '2 PLAC Berlin', '3 TRAN Berurin', '4 LANG xx-unknown', '0 TRLR').join('\n'),
    );
    to551(dataset);
    const text = ser551(dataset);
    expect(text).not.toContain('FONE');
    expect(text).not.toContain('ROMN');
  });

  test('5.5.1 drops a media file with an unmappable format', () => {
    const dataset = parse70(H70.concat('0 @O1@ OBJE', '1 FILE a.pdf', '2 FORM application/pdf', '0 TRLR').join('\n'));
    to551(dataset);
    const text = ser551(dataset);
    expect(text).not.toContain('FILE');
  });
});

describe('place record emission', () => {
  const germanCard = (): GedcomDataset =>
    parse70(
      H70.concat(
        '0 @S2@ SOUR',
        '1 TITL S',
        '0 @L2@ _LOC',
        '1 NAME Parent',
        '0 @L1@ _LOC',
        '1 NAME Berlin',
        '2 ABBR B',
        '3 TYPE short',
        '2 LANG de',
        '2 DATE 1900',
        '2 SOUR @S2@',
        '1 NAME Berlin, Deutschland',
        '1 TYPE City',
        '2 _GOVTYPE 44',
        '2 DATE 1901',
        '2 SOUR @S2@',
        '1 _GOV 11000000',
        '1 _MAIDENHEAD JO62',
        '1 _POST 10115',
        '2 DATE 1900',
        '2 SOUR @S2@',
        '1 _AIDN 123',
        '2 TYPE amtlich',
        '2 DATE 1900',
        '2 SOUR @S2@',
        '1 _DMGD 3.5m',
        '2 TYPE population',
        '2 DATE 1900',
        '2 SOUR @S2@',
        '1 RELI Catholic',
        '1 EVEN founded',
        '2 DATE 1237',
        '1 _LOC @L2@',
        '2 TYPE POLI',
        '2 DATE 1900',
        '2 SOUR @S2@',
        '1 MAP',
        '2 LATI N52.52',
        '2 LONG E13.40',
        '0 TRLR',
      ).join('\n'),
    );

  test('the German card survives as a _LOC record in 7.0', () => {
    const text = ser70(germanCard());
    expect(text).toContain('0 @L1@ _LOC');
    expect(text).toContain('1 NAME Berlin');
    expect(text).toContain('2 ABBR B');
    expect(text).toContain('3 TYPE short');
    expect(text).toContain('2 LANG de');
    expect(text).toContain('2 DATE 1900');
    expect(text).toContain('2 SOUR @S2@');
    expect(text).toContain('1 TYPE City');
    expect(text).toContain('2 _GOVTYPE 44');
    expect(text).toContain('1 _GOV 11000000');
    expect(text).toContain('1 _MAIDENHEAD JO62');
    expect(text).toContain('1 _POST 10115');
    expect(text).toContain('1 _AIDN 123');
    expect(text).toContain('2 TYPE amtlich');
    expect(text).toContain('1 _DMGD 3.5m');
    expect(text).toContain('2 TYPE population');
    expect(text).toContain('1 RELI Catholic');
    expect(text).toContain('1 EVEN founded');
    expect(text).toContain('2 DATE 1237');
    expect(text).toContain('1 _LOC @L2@');
    expect(text).toContain('2 TYPE POLI');
    expect(text).toContain('1 MAP');
    expect(text).toContain('2 LATI N52.52');
    expect(text).toContain('2 LONG E13.4');
  });

  test('the German card survives in 5.5.1 as well', () => {
    const dataset = germanCard();
    to551(dataset);
    const text = ser551(dataset);
    expect(text).toContain('0 @L1@ _LOC');
    expect(text).toContain('1 NAME Berlin');
    expect(text).toContain('2 ABBR B');
    expect(text).toContain('3 TYPE short');
  });
});

describe('ordinance details', () => {
  test('SLGS with a date only', () => {
    const dataset = parse70(H70.concat('0 @F1@ FAM', '1 SLGS', '2 DATE 1 JAN 2000', '0 TRLR').join('\n'));
    const text = ser70(dataset);
    expect(text).toContain('1 SLGS');
    expect(text).toContain('2 DATE 1 JAN 2000');
  });

  test('5.5.1 drops the Y assertion on non-MARR family events', () => {
    const dataset = parse70(H70.concat('0 @F1@ FAM', '1 DIVF Y', '0 TRLR').join('\n'));
    to551(dataset);
    const text = ser551(dataset);
    expect(text).toContain('1 DIVF');
    expect(text).not.toContain('1 DIVF Y');
  });

  test('7.0 keeps the Y assertion', () => {
    const dataset = parse70(H70.concat('0 @F1@ FAM', '1 DIVF Y', '0 TRLR').join('\n'));
    expect(ser70(dataset)).toContain('1 DIVF Y');
  });
});

describe('citation emission details', () => {
  test('7.0 inline notes keep translations', () => {
    const dataset = parse70(
      H70.concat('0 @I1@ INDI', '1 NOTE text', '2 TRAN de', '3 MIME text/plain', '3 LANG de', '0 TRLR').join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('1 NOTE text');
    expect(text).toContain('2 TRAN de');
    expect(text).toContain('3 MIME text/plain');
    expect(text).toContain('3 LANG de');
  });

  test('7.0 place phonetic variations with known methods', () => {
    const dataset = parse551(
      [...H551, '0 @I1@ INDI', '1 BIRT', '2 PLAC Berlin', '3 FONE Berurin', '4 TYPE kana', ...SUBM, '0 TRLR'].join(
        '\n',
      ),
    );
    const text = ser70(dataset);
    expect(text).toContain('3 TRAN Berurin');
    expect(text).toContain('4 LANG ja-Kana');
  });

  test('ADOP keeps its PHRASE', () => {
    const dataset = parse70(
      H70.concat(
        '0 @F1@ FAM',
        '0 @I1@ INDI',
        '1 ADOP',
        '2 FAMC @F1@',
        '3 ADOP BOTH',
        '4 PHRASE both parents',
        '0 TRLR',
      ).join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('3 ADOP BOTH');
    expect(text).toContain('4 PHRASE both parents');
  });

  test('7.0 submitter falls back to the address contacts', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @S1@ SUBM',
        '1 NAME T',
        '1 ADDR x',
        '2 EMAIL a@@b.example',
        '2 WWW https://w.example',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('1 EMAIL a@b.example');
    expect(text).toContain('1 WWW https://w.example');
  });

  test('submitter media and 5.5.1 RFN', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @O1@ OBJE',
        '1 FILE a.jpg',
        '2 FORM jpg',
        '0 @S1@ SUBM',
        '1 NAME T',
        '1 OBJE @O1@',
        '1 RFN 99',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('1 OBJE @O1@');
    expect(text).toContain('1 RFN 99');
  });

  test('citation data date, texts, ancestry pointers, reference and verified', () => {
    const dataset = parse70(
      H70.concat(
        '0 @S2@ SOUR',
        '1 TITL S',
        '0 @I1@ INDI',
        '1 BIRT',
        '2 SOUR @S2@',
        '3 PAGE p.1',
        '3 DATA',
        '4 DATE 1900',
        '4 TEXT excerpt',
        '5 MIME text/plain',
        '5 LANG en',
        '3 _APID 123',
        '3 _CREF c',
        '3 _VERI Y',
        '0 TRLR',
      ).join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('3 PAGE p.1');
    expect(text).toContain('3 DATA');
    expect(text).toContain('4 DATE 1900');
    expect(text).toContain('4 TEXT excerpt');
    expect(text).toContain('5 MIME text/plain');
    expect(text).toContain('5 LANG en');
    expect(text).toContain('3 _APID 123');
    expect(text).toContain('3 _CREF c');
    expect(text).toContain('3 _VERI Y');
  });

  test('7.0 citation event roles with phrases', () => {
    const dataset = parse70(
      H70.concat(
        '0 @S2@ SOUR',
        '1 TITL S',
        '0 @I1@ INDI',
        '1 BIRT',
        '2 SOUR @S2@',
        '3 EVEN BIRT',
        '4 PHRASE the event',
        '4 ROLE WITN',
        '5 PHRASE the witness',
        '0 TRLR',
      ).join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('3 EVEN BIRT');
    expect(text).toContain('4 PHRASE the event');
    expect(text).toContain('4 ROLE WITN');
    expect(text).toContain('5 PHRASE the witness');
  });

  test('5.5.1 citation event roles spell out the descriptor', () => {
    const dataset = parse70(
      H70.concat(
        '0 @S2@ SOUR',
        '1 TITL S',
        '0 @I1@ INDI',
        '1 BIRT',
        '2 SOUR @S2@',
        '3 EVEN BIRT',
        '4 ROLE WITN',
        '0 TRLR',
      ).join('\n'),
    );
    to551(dataset);
    const text = ser551(dataset);
    expect(text).toContain('3 EVEN BIRT');
    expect(text).toContain('4 ROLE (Witness)');
  });

  test('a 5.5.1 void citation with media and notes', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @O1@ OBJE',
        '1 FILE a.jpg',
        '2 FORM jpg',
        '0 @I1@ INDI',
        '1 BIRT',
        '2 SOUR free text',
        '3 TEXT excerpt',
        '3 OBJE @O1@',
        '3 NOTE n',
        '3 QUAY 2',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('2 SOUR free text');
    expect(text).toContain('3 TEXT excerpt');
    expect(text).toContain('3 OBJE @O1@');
    expect(text).toContain('3 NOTE n');
    expect(text).toContain('3 QUAY 2');
  });
});

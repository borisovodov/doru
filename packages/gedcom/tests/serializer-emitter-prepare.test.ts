import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom551Bytes, serializeGedcom70 } from '../src/serialize/serialize';
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

describe('prepareFor551 pointer stripping and the NO rule', () => {
  test('dangling pointers are stripped and emptied records dropped', () => {
    const dataset = parse70(H70.concat('0 TRLR').join('\n'));
    dataset.records.push({
      tag: 'INDI',
      xref: '@I1@',
      submitters: ['@MISS@'],
      associations: [{ tag: 'ASSO', individual: '@MISS@' }],
      aliases: [{ tag: 'ALIA', individual: '@MISS@' }],
      ancestorInterests: ['@MISS@'],
      descendantInterests: ['@MISS@'],
      spouseFamilies: [{ tag: 'FAMS', family: '@MISS@' }],
      childFamilies: [{ tag: 'FAMC', family: '@MISS@' }],
      events: [
        { tag: 'BIRT', familyChild: '@MISS@' },
        { tag: 'ADOP', adoptionFamily: { family: '@MISS@' } },
      ],
      ordinances: [{ tag: 'SLGC', familyChild: '@MISS@' }],
      notes: [{ tag: 'NOTE', note: '@MISS@' }],
      citations: [
        { tag: 'SOUR', source: '@MISS@' },
        { tag: 'SOUR', source: '@VOID@', description: 'kept' },
      ],
      media: [{ tag: 'OBJE', object: '@MISS@' }],
    } as never);
    dataset.records.push({
      tag: 'FAM',
      xref: '@F1@',
      husband: { partner: '@MISS@' },
      wife: { partner: '@MISS@' },
      children: [{ child: '@MISS@' }],
      nonEvents: [{ tag: 'NO', payload: 'MARR' }],
      restriction: ['LOCKED'],
    } as never);
    // A bare INDI carrying only NO BIRT: the negation is dropped, the
    // record is left empty and removed entirely.
    dataset.records.push({ tag: 'INDI', xref: '@I2@', nonEvents: [{ tag: 'NO', payload: 'BIRT' }] } as never);
    const text = ser551(dataset);
    expect(text).not.toContain('@I2@');
    // The stripped INDI kept its (dangling-free) events; its void citation survived.
    expect(text).toContain('0 @I1@ INDI');
    expect(text).toContain('1 BIRT');
    expect(text).toContain('1 ADOP');
    expect(text).toContain('1 SOUR kept');
    // The FAM kept only its negation and restriction.
    expect(text).toContain('0 @F1@ FAM');
    expect(text).toContain('1 _MARR N');
    expect(text).toContain('1 RESN locked');
    expect(text).not.toContain('@MISS@');
  });

  test('a void submission submitter is dropped', () => {
    const dataset = parse551(
      [
        '0 HEAD',
        '1 SOUR PAF',
        '1 SUBM @S1@',
        '1 SUBN @N1@',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '0 @N1@ SUBN',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 TRLR',
      ].join('\n'),
    );
    dataset.submission = { tag: 'SUBN', xref: '@N1@', submitter: '@VOID@' };
    const text = ser551(dataset);
    expect(text).toContain('0 @N1@ SUBN');
    expect(text).not.toContain('1 SUBM @VOID@');
  });

  test('the PEDI projection skips unmapped relations', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @F1@ FAM',
        '1 CHIL @I1@',
        '2 _FREL stepson',
        '2 _MREL stepson',
        '0 @I1@ INDI',
        '1 FAMC @F1@',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser70(dataset);
    expect(text).not.toContain('PEDI');
  });

  test('a card without an xref is skipped by the place flattening', () => {
    const dataset = parse70(H70.concat('0 TRLR').join('\n'));
    dataset.records.push({ tag: '_PLAC', payload: 'Nowhere' } as never);
    const text = ser70(dataset);
    expect(text).not.toContain('_PLAC');
  });
});

describe('serializer byte encodings', () => {
  test('a lone low surrogate is rejected', () => {
    const dataset = parse70(H70.concat('0 TRLR').join('\n'));
    dataset.header.note = { tag: 'NOTE', payload: 'bad \udc00 text' };
    const result = serializeGedcom551Bytes(dataset);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('serialize.invalid-text');
    }
  });
});

describe('record emitters', () => {
  test('FAM restrictions, partner phrases, child phrases and submitters', () => {
    const dataset = parse70(
      H70.concat(
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '0 @I2@ INDI',
        '1 NAME C /D/',
        '0 @F1@ FAM',
        '1 RESN LOCKED',
        '1 HUSB @I1@',
        '2 PHRASE the husband',
        '1 WIFE @I2@',
        '2 PHRASE the wife',
        '1 CHIL @I1@',
        '2 PHRASE the child',
        '2 _PREF Y',
        '2 _STAT twin',
        '1 SUBM @S1@',
        '1 NO MARR',
        '2 DATE FROM 1900 TO 1910',
        '3 PHRASE approx',
        '2 NOTE n',
        '2 SOUR @S2@',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 @S2@ SOUR',
        '1 TITL S',
        '0 TRLR',
      ).join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('1 RESN LOCKED');
    expect(text).toContain('2 PHRASE the husband');
    expect(text).toContain('2 PHRASE the wife');
    expect(text).toContain('2 PHRASE the child');
    expect(text).toContain('2 _PREF Y');
    expect(text).toContain('2 _STAT twin');
    expect(text).toContain('1 SUBM @S1@');
    expect(text).toContain('1 NO MARR');
    expect(text).toContain('3 PHRASE approx');
    expect(text).toContain('2 NOTE n');
    expect(text).toContain('2 SOUR @S2@');
  });

  test('5.5.1 FAM restrictions are lowercase', () => {
    const dataset = parse551([...H551, '0 @F1@ FAM', '1 RESN privacy', ...SUBM, '0 TRLR'].join('\n'));
    expect(ser551(dataset)).toContain('1 RESN privacy');
  });

  test('7.0 FAM attributes: RESI and FACT', () => {
    const dataset = parse70(
      H70.concat('0 @F1@ FAM', '1 RESI Somewhere', '2 TYPE home', '1 FACT something', '2 TYPE kind', '0 TRLR').join(
        '\n',
      ),
    );
    const text = ser70(dataset);
    expect(text).toContain('1 RESI Somewhere');
    expect(text).toContain('2 TYPE home');
    expect(text).toContain('1 FACT something');
    expect(text).toContain('2 TYPE kind');
  });

  test('family partner ages round-trip', () => {
    const dataset = parse70(
      H70.concat(
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '0 @I2@ INDI',
        '1 NAME C /D/',
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 WIFE @I2@',
        '1 MARR',
        '2 HUSB',
        '3 AGE 30y',
        '2 WIFE',
        '3 AGE 28y',
        '0 TRLR',
      ).join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('2 HUSB');
    expect(text).toContain('3 AGE 30y');
    expect(text).toContain('2 WIFE');
    expect(text).toContain('3 AGE 28y');
  });

  test('INDI pedigree, status and family link notes', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '0 @I1@ INDI',
        '1 FAMC @F1@',
        '2 _PRIMARY Y',
        '2 _PREF Y',
        '2 PEDI birth',
        '2 STAT proven',
        '2 NOTE n',
        '1 FAMS @F1@',
        '2 NOTE f',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('2 PEDI birth');
    expect(text).toContain('2 STAT proven');
    expect(text).toContain('2 NOTE n');
    expect(text).toContain('2 NOTE f');
    // 5.5.1 has no PHRASE slot under PEDI/STAT; the 7.0 PHRASE
    // substructures are dropped on 5.5.1 output.
    expect(text).not.toContain('PHRASE');
  });

  test('7.0 PEDI and STAT phrases round-trip', () => {
    const dataset = parse70(
      [
        ...H70,
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '0 @I1@ INDI',
        '1 FAMC @F1@',
        '2 PEDI BIRTH',
        '3 PHRASE pedigree phrase',
        '2 STAT PROVEN',
        '3 PHRASE status phrase',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('2 PEDI BIRTH');
    expect(text).toContain('3 PHRASE pedigree phrase');
    expect(text).toContain('2 STAT PROVEN');
    expect(text).toContain('3 PHRASE status phrase');
  });

  test('OBJE restriction is 7.0-only', () => {
    const dataset = parse70(
      H70.concat('0 @O1@ OBJE', '1 RESN LOCKED', '1 FILE a.jpg', '2 FORM image/jpeg', '0 TRLR').join('\n'),
    );
    expect(ser70(dataset)).toContain('1 RESN LOCKED');
    const text551 = ser551(dataset);
    expect(text551).not.toContain('RESN');
  });

  test('REPO contact relocation', () => {
    const dataset = parse70(
      H70.concat(
        '0 @R1@ REPO',
        '1 NAME R',
        '1 PHON 1',
        '1 EMAIL a@example.com',
        '1 FAX 2',
        '1 WWW https://w.example',
        '0 TRLR',
      ).join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('1 PHON 1');
    expect(text).toContain('1 EMAIL a@example.com');
    expect(text).toContain('1 FAX 2');
    expect(text).toContain('1 WWW https://w.example');
  });

  test('SNOTE record keeps translations', () => {
    const dataset = parse70(
      H70.concat(
        '0 @N1@ SNOTE text',
        '1 MIME text/plain',
        '1 LANG en',
        '1 TRAN de',
        '2 MIME text/plain',
        '2 LANG de',
        '0 TRLR',
      ).join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('1 MIME text/plain');
    expect(text).toContain('1 LANG en');
    expect(text).toContain('1 TRAN de');
    expect(text).toContain('2 MIME text/plain');
    expect(text).toContain('2 LANG de');
  });

  test('SOUR record with DATA, TEXT, _FULL and _TMPLT', () => {
    const dataset = parse70(
      H70.concat(
        '0 @S1@ SOUR',
        '1 DATA',
        '2 EVEN BIRT, DEAT',
        '3 DATE FROM 1900 TO 1910',
        '4 PHRASE approx',
        '3 PLAC Paris',
        '2 AGNC The Agency',
        '2 NOTE data note',
        '1 TEXT the transcript',
        '2 MIME text/plain',
        '2 LANG en',
        '1 _FULL the footnote',
        '1 _TMPLT',
        '2 TID 123',
        '2 FIELD',
        '3 NAME Author',
        '3 VALUE John',
        '0 TRLR',
      ).join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('1 DATA');
    expect(text).toContain('2 EVEN BIRT, DEAT');
    expect(text).toContain('3 DATE FROM 1900 TO 1910');
    expect(text).toContain('4 PHRASE approx');
    expect(text).toContain('3 PLAC Paris');
    expect(text).toContain('2 AGNC The Agency');
    expect(text).toContain('2 NOTE data note');
    expect(text).toContain('1 TEXT the transcript');
    expect(text).toContain('2 MIME text/plain');
    expect(text).toContain('2 LANG en');
    expect(text).toContain('1 _FULL the footnote');
    expect(text).toContain('1 _TMPLT');
    expect(text).toContain('2 TID 123');
    expect(text).toContain('3 NAME Author');
    expect(text).toContain('3 VALUE John');
  });

  test('identifier TYPE lines', () => {
    const dataset = parse70(
      H70.concat(
        '0 @I1@ INDI',
        '1 REFN r1',
        '2 TYPE user',
        '1 EXID https://example.com/i',
        '2 TYPE https://example.com/t',
        '0 TRLR',
      ).join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('1 REFN r1');
    expect(text).toContain('2 TYPE user');
    expect(text).toContain('2 TYPE https://example.com/t');
  });

  test('submission change dates with notes', () => {
    const dataset = parse551(
      [
        '0 HEAD',
        '1 SOUR PAF',
        '1 SUBM @S1@',
        '1 SUBN @N1@',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '0 @N1@ SUBN',
        '1 CHAN',
        '2 DATE 4 JAN 2001',
        '2 NOTE changed',
        '1 NOTE n',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('1 CHAN');
    expect(text).toContain('2 DATE 4 JAN 2001');
    expect(text).toContain('2 NOTE changed');
    expect(text).toContain('1 NOTE n');
  });
});

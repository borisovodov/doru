import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parse70(text: string): GedcomDataset {
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

function err551(text: string): string {
  const result = parseGedcom551(enc(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
}

function ser70(dataset: GedcomDataset): string {
  const result = serializeGedcom70(dataset);
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

const H70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0'];
const H551 = [
  '0 HEAD',
  '1 SOUR PAF',
  '1 SUBM @S1@',
  '1 GEDC',
  '2 VERS 5.5.1',
  '2 FORM LINEAGE-LINKED',
  '1 CHAR UTF-8',
  '0 @S1@ SUBM',
  '1 NAME Tester',
];

// A 7.0 document exercising SNOTE in every position the 7.0 grammar
// allows it (NOTE_STRUCTURE {0:M} expansions: FAM, INDI, FAMS, FAMC,
// event details, NO, ASSO, ordinance details, NAME, PLAC, citations,
// SOUR.DATA, repository citations, the records, CHAN, and HEAD).
const SNOTE_EVERYWHERE = [
  ...H70,
  '1 SNOTE @N1@',
  '0 @F1@ FAM',
  '1 SNOTE @N1@',
  '1 MARR',
  '2 SNOTE @N1@',
  '1 NO DIV',
  '2 SNOTE @N1@',
  '1 ASSO @I2@',
  '2 ROLE OTHER',
  '2 SNOTE @N1@',
  '1 SLGS',
  '2 DATE 1 JAN 2000',
  '2 SNOTE @N1@',
  '0 @I1@ INDI',
  '1 SNOTE @N1@',
  '1 NAME John /Doe/',
  '2 SNOTE @N1@',
  '1 FAMS @F1@',
  '2 SNOTE @N1@',
  '1 FAMC @F2@',
  '2 SNOTE @N1@',
  '1 BIRT',
  '2 PLAC A place',
  '3 SNOTE @N1@',
  '2 SNOTE @N1@',
  '1 NO EMIG',
  '2 SNOTE @N1@',
  '1 ASSO @I2@',
  '2 ROLE FRIEND',
  '2 SNOTE @N1@',
  '1 SLGC',
  '2 DATE 1 JAN 2000',
  '2 SNOTE @N1@',
  '1 SOUR @S1@',
  '2 SNOTE @N1@',
  '1 CHAN',
  '2 DATE 1 JAN 2000',
  '2 SNOTE @N1@',
  '0 @I2@ INDI',
  '0 @F2@ FAM',
  '0 @O1@ OBJE',
  '1 FILE a.jpg',
  '2 FORM image/jpeg',
  '1 SNOTE @N1@',
  '0 @R1@ REPO',
  '1 NAME Repo',
  '1 SNOTE @N1@',
  '0 @S1@ SOUR',
  '1 SNOTE @N1@',
  '1 DATA',
  '2 SNOTE @N1@',
  '1 REPO @R1@',
  '2 SNOTE @N1@',
  '0 @N1@ SNOTE Shared note',
  '0 @U1@ SUBM',
  '1 NAME Tester',
  '1 SNOTE @N1@',
  '0 TRLR',
].join('\n');

describe('SNOTE coverage (GEDCOM 7.0)', () => {
  test('parses SNOTE in every 7.0 position', () => {
    const dataset = parse70(SNOTE_EVERYWHERE);
    const fam = dataset.records.find((record) => record.tag === 'FAM' && record.xref === '@F1@') as {
      notes?: Array<{ tag: string; note?: string }>;
      events?: Array<{ detail?: { detail?: { notes?: Array<{ tag: string; note?: string }> } } }>;
      nonEvents?: Array<{ notes?: Array<{ tag: string; note?: string }> }>;
      associations?: Array<{ notes?: Array<{ tag: string; note?: string }> }>;
      spouseSealings?: Array<{ detail?: { notes?: Array<{ tag: string; note?: string }> } }>;
    };
    expect(fam.notes?.map((note) => note.tag)).toEqual(['SNOTE']);
    expect(fam.notes?.[0]?.note).toBe('@N1@');
    expect(fam.events?.[0]?.detail?.detail?.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(fam.nonEvents?.[0]?.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(fam.associations?.[0]?.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(fam.spouseSealings?.[0]?.detail?.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });

    const indi = dataset.records.find((record) => record.tag === 'INDI' && record.xref === '@I1@') as {
      notes?: Array<{ tag: string; note?: string }>;
      names?: Array<{ notes?: Array<{ tag: string; note?: string }> }>;
      spouseFamilies?: Array<{ notes?: Array<{ tag: string; note?: string }> }>;
      childFamilies?: Array<{ notes?: Array<{ tag: string; note?: string }> }>;
      events?: Array<{ detail?: { place?: { notes?: Array<{ tag: string; note?: string }> }; notes?: Array<{ tag: string; note?: string }> } }>;
      nonEvents?: Array<{ notes?: Array<{ tag: string; note?: string }> }>;
      associations?: Array<{ notes?: Array<{ tag: string; note?: string }> }>;
      ordinances?: Array<{ detail?: { notes?: Array<{ tag: string; note?: string }> } }>;
      citations?: Array<{ notes?: Array<{ tag: string; note?: string }> }>;
      changeDate?: { notes?: Array<{ tag: string; note?: string }> };
    };
    expect(indi.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(indi.names?.[0]?.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(indi.spouseFamilies?.[0]?.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(indi.childFamilies?.[0]?.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(indi.events?.[0]?.detail?.place?.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(indi.events?.[0]?.detail?.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(indi.nonEvents?.[0]?.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(indi.associations?.[0]?.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(indi.ordinances?.[0]?.detail?.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(indi.citations?.[0]?.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(indi.changeDate?.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });

    const media = dataset.records.find((record) => record.tag === 'OBJE') as { notes?: Array<{ tag: string; note?: string }> };
    const repo = dataset.records.find((record) => record.tag === 'REPO') as { notes?: Array<{ tag: string; note?: string }> };
    const sour = dataset.records.find((record) => record.tag === 'SOUR') as {
      notes?: Array<{ tag: string; note?: string }>;
      data?: { notes?: Array<{ tag: string; note?: string }> };
      repositoryCitations?: Array<{ notes?: Array<{ tag: string; note?: string }> }>;
    };
    const subm = dataset.records.find((record) => record.tag === 'SUBM') as { notes?: Array<{ tag: string; note?: string }> };
    expect(media.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(repo.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(sour.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(sour.data?.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(sour.repositoryCitations?.[0]?.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(subm.notes?.[0]).toEqual({ tag: 'SNOTE', note: '@N1@' });
    expect(dataset.header.note).toEqual({ tag: 'SNOTE', note: '@N1@' });
  });

  test('rejects SNOTE with substructures and bad pointers', () => {
    expect(
      err70([...H70, '0 @N1@ SNOTE text', '0 @I1@ INDI', '1 SNOTE @N1@', '2 BOGUS x', '0 TRLR'].join('\n')),
    ).toBe('structure.unknown-tag');
    expect(
      err70([...H70, '0 @I1@ INDI', '1 SNOTE @NOPE@', '0 TRLR'].join('\n')),
    ).toBe('document.xref-not-found');
  });

  test('keeps SNOTE on a 7.0 round trip', () => {
    const dataset = parse70(SNOTE_EVERYWHERE);
    const out = ser70(dataset);
    expect(out).toContain('1 SNOTE @N1@');
    expect(out).toContain('2 SNOTE @N1@');
    expect(out).toContain('3 SNOTE @N1@');
    expect(out).toContain('0 @N1@ SNOTE Shared note');
  });

  test('5.5.1 input stays strict: SNOTE is a 7.0-only tag', () => {
    expect(err551([...H551, '0 @I1@ INDI', '1 SNOTE @N1@', '0 TRLR'].join('\n'))).toBe('structure.unknown-tag');
  });
});

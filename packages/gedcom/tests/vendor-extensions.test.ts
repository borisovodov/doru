import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { FamilyRecord, GedcomDataset, IndividualRecord, SourceCitation } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

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

/**
 * A 5.5.1 file exercising the typed vendor extensions: _UID (record and
 * event level), _SDATE, _SHAR with _ROLE and with the standard ROLE tag,
 * _PRIM on a pointer OBJE link, _FREL/_MREL under CHIL, _APID under a
 * citation, plus an unknown _FOO that must stay a generic extension.
 */
const SAMPLE551 = [
  '0 HEAD',
  '1 SOUR PAF',
  '1 SUBM @S1@',
  '1 GEDC',
  '2 VERS 5.5.1',
  '2 FORM LINEAGE-LINKED',
  '1 CHAR UTF-8',
  '0 @S1@ SUBM',
  '1 NAME T',
  '0 @I1@ INDI',
  '1 NAME John /Doe/',
  '1 _UID f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
  '1 _FOO bar',
  '1 BIRT',
  '2 DATE 12 MAR 1923',
  '2 _SDATE 1923',
  '2 _SHAR @I2@',
  '3 _ROLE Witness',
  '1 DEAT',
  '2 _UID aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  '1 OBJE @M1@',
  '2 _PRIM Y',
  '1 FAMS @F1@',
  '1 FAMC @F1@',
  '2 PEDI birth',
  '0 @I2@ INDI',
  '1 NAME Jane /Roe/',
  '0 @F1@ FAM',
  '1 HUSB @I1@',
  '1 WIFE @I2@',
  '1 CHIL @I3@',
  '2 _FREL Natural',
  '2 _MREL Adopted',
  '1 MARR',
  '2 SOUR @S1@',
  '3 _APID 1,7602::2771226',
  '2 _SHAR @I2@',
  '3 ROLE Maid of Honor',
  '0 @I3@ INDI',
  '1 NAME Kid /Doe/',
  '1 FAMC @F1@',
  '0 @M1@ OBJE',
  '1 FILE picture.jpg',
  '2 FORM jpg',
  '0 TRLR',
].join('\n');

function indi(dataset: GedcomDataset, xref: string): IndividualRecord {
  const record = dataset.records.find((r) => r.xref === xref);
  if (record === undefined || record.tag !== 'INDI') {
    throw new Error(`expected INDI ${xref}`);
  }
  return record;
}

function fam(dataset: GedcomDataset, xref: string): FamilyRecord {
  const record = dataset.records.find((r) => r.xref === xref);
  if (record === undefined || record.tag !== 'FAM') {
    throw new Error(`expected FAM ${xref}`);
  }
  return record;
}

describe('vendor extensions on 5.5.1 input', () => {
  test('normalizes the typed tags into the model', () => {
    const dataset = parseOk551(SAMPLE551);

    // _UID on the record.
    expect(indi(dataset, '@I1@').identifiers).toEqual([
      { tag: 'UID', payload: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6' },
    ]);

    // _UID on the event detail.
    const death = indi(dataset, '@I1@').events?.find((e) => e.tag === 'DEAT');
    expect(death?.detail?.uniqueIds).toEqual(['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee']);

    // _SDATE on the event detail.
    const birth = indi(dataset, '@I1@').events?.find((e) => e.tag === 'BIRT');
    expect(birth?.detail?.sortDate?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', year: 1923 });

    // _SHAR + _ROLE becomes an association with ROLE OTHER + PHRASE.
    expect(birth?.detail?.associations).toEqual([
      { tag: 'ASSO', individual: '@I2@', role: { payload: 'OTHER', phrase: 'Witness' } },
    ]);

    // _SHAR + standard ROLE is the same normalization.
    const marr = fam(dataset, '@F1@').events?.find((e) => e.tag === 'MARR');
    expect(marr?.detail?.detail?.associations).toEqual([
      { tag: 'ASSO', individual: '@I2@', role: { payload: 'OTHER', phrase: 'Maid of Honor' } },
    ]);

    // _PRIM on the pointer OBJE link.
    const link = indi(dataset, '@I1@').media?.[0];
    expect(link?.primary).toBe(true);

    // _FREL/_MREL under CHIL.
    expect(fam(dataset, '@F1@').children?.[0]).toMatchObject({
      child: '@I3@',
      fatherRelation: 'Natural',
      motherRelation: 'Adopted',
    });

    // _APID under the citation.
    const citation = marr?.detail?.detail?.citations?.[0] as SourceCitation | undefined;
    expect(citation?.ancestryPointers).toEqual(['1,7602::2771226']);

    // The unknown underscore tag stays a generic extension.
    expect(indi(dataset, '@I1@').extensions).toEqual([expect.objectContaining({ tag: '_FOO' })]);
  });

  test('round-trips through the 5.5.1 serializer unchanged', () => {
    const first = parseOk551(SAMPLE551);
    const second = parseOk551(ser551(first));
    expect(second).toEqual(first);
  });
});

describe('vendor extensions on 5.5.1 output', () => {
  test('writes the vendor tags back', () => {
    const text = ser551(parseOk551(SAMPLE551));
    expect(text).toContain('1 _UID f81d4fae-7dec-11d0-a765-00a0c91e6bf6');
    expect(text).toContain('2 _SDATE 1923');
    expect(text).toContain('2 _SHAR @I2@');
    expect(text).toContain('3 _ROLE Witness');
    expect(text).toContain('3 _ROLE Maid of Honor');
    expect(text).toContain('2 _PRIM Y');
    expect(text).toContain('2 _FREL Natural');
    expect(text).toContain('2 _MREL Adopted');
    expect(text).toContain('3 _APID 1,7602::2771226');
    expect(text).toContain('2 _UID aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(text).toContain('1 _FOO bar');
  });
});

describe('vendor extensions on 7.0 output', () => {
  test('uses the standard 7.0 structures', () => {
    const text = ser70(parseOk551(SAMPLE551));
    // Standard tags, not vendor tags.
    expect(text).toContain('1 UID f81d4fae-7dec-11d0-a765-00a0c91e6bf6');
    expect(text).toContain('2 UID aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(text).toContain('2 SDATE 1923');
    expect(text).toContain('2 ASSO @I2@');
    expect(text).toContain('3 ROLE OTHER');
    expect(text).toContain('4 PHRASE Witness');
    expect(text).toContain('4 PHRASE Maid of Honor');
    // No standard 7.0 equivalent: the vendor tags are written in both versions.
    expect(text).toContain('2 _PRIM Y');
    expect(text).toContain('3 _APID 1,7602::2771226');
    // The disagreeing relation pair has no PEDI projection: dropped.
    expect(text).not.toContain('_FREL');
    expect(text).not.toContain('_MREL');
    // The _FOO extension is preserved verbatim.
    expect(text).toContain('1 _FOO bar');
  });

  test('translates matching _FREL/_MREL into INDI.FAMC.PEDI', () => {
    const sample = parseOk551(
      [
        '0 HEAD',
        '1 SOUR PAF',
        '1 SUBM @S1@',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 @I1@ INDI',
        '1 NAME Dad /Doe/',
        '0 @I2@ INDI',
        '1 NAME Mom /Doe/',
        '0 @I3@ INDI',
        '1 NAME Kid /Doe/',
        '1 FAMC @F1@',
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 WIFE @I2@',
        '1 CHIL @I3@',
        '2 _FREL Natural',
        '2 _MREL Natural',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser70(sample);
    // The PEDI was filled on the FAMC link by prepareFor70.
    expect(text).toContain('2 PEDI BIRTH');
    expect(text).not.toContain('_FREL');
    expect(text).not.toContain('_MREL');
    const via70 = parseOk70(text);
    const famc = indi(via70, '@I3@').childFamilies?.[0];
    expect(famc?.pedigree?.payload).toBe('BIRTH');
  });

  test('does not invent a PEDI when the relations disagree', () => {
    const sample = parseOk551(
      [
        '0 HEAD',
        '1 SOUR PAF',
        '1 SUBM @S1@',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 @I1@ INDI',
        '1 NAME Dad /Doe/',
        '0 @I3@ INDI',
        '1 NAME Kid /Doe/',
        '1 FAMC @F1@',
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 CHIL @I3@',
        '2 _FREL Natural',
        '2 _MREL Adopted',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser70(sample);
    expect(text).not.toContain('_FREL');
    expect(text).not.toContain('_MREL');
    expect(text).not.toContain('PEDI');
  });
});

describe('the additionally typed vendor tags', () => {
  const indi = (dataset: GedcomDataset): IndividualRecord => {
    const record = dataset.records.find((r) => r.tag === 'INDI');
    if (record === undefined) {
      throw new Error('expected INDI');
    }
    return record as IndividualRecord;
  };
  const fam = (dataset: GedcomDataset): FamilyRecord => {
    const record = dataset.records.find((r) => r.tag === 'FAM');
    if (record === undefined) {
      throw new Error('expected FAM');
    }
    return record as FamilyRecord;
  };

  test('_FSFTID under INDI', () => {
    const dataset = parseOk551(
      [
        '0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8',
        '0 @S1@ SUBM', '1 NAME T',
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '1 _FSFTID KWJ1-2B3',
        '0 TRLR',
      ].join('\n'),
    );
    expect(indi(dataset).familySearchId).toBe('KWJ1-2B3');
    const text = ser551(dataset);
    expect(text).toContain('1 _FSFTID KWJ1-2B3');
    expect(ser70(dataset)).toContain('1 _FSFTID KWJ1-2B3');
  });

  test('_TODO under INDI and FAM with DESC/PRTY/STAT/DATE/NOTE', () => {
    const dataset = parseOk551(
      [
        '0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8',
        '0 @S1@ SUBM', '1 NAME T',
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '1 _TODO Find the will',
        '2 DESC Search the probate records',
        '2 PRTY high',
        '2 STAT open',
        '2 DATE 2026',
        '2 NOTE Start in the county archive',
        '0 @F1@ FAM',
        '1 _TODO',
        '2 DESC Order the marriage record',
        '0 TRLR',
      ].join('\n'),
    );
    const person = indi(dataset);
    expect(person.todos?.[0]?.payload).toBe('Find the will');
    expect(person.todos?.[0]?.description).toBe('Search the probate records');
    expect(person.todos?.[0]?.priority).toBe('high');
    expect(person.todos?.[0]?.status).toBe('open');
    expect(person.todos?.[0]?.date?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', year: 2026 });
    expect(person.todos?.[0]?.notes?.[0]?.payload).toBe('Start in the county archive');
    expect(fam(dataset).todos?.[0]?.payload).toBeUndefined();
    expect(fam(dataset).todos?.[0]?.description).toBe('Order the marriage record');

    const text = ser551(dataset);
    expect(text).toContain('1 _TODO Find the will');
    expect(text).toContain('2 DESC Search the probate records');
    expect(text).toContain('2 PRTY high');
    expect(text).toContain('2 STAT open');
    expect(text).toContain('2 DATE 2026');
    expect(parseOk551(text)).toEqual(dataset);
    expect(ser70(dataset)).toContain('1 _TODO Find the will');
  });

  test('_PREF under FAM.HUSB and FAM.WIFE', () => {
    const dataset = parseOk551(
      [
        '0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8',
        '0 @S1@ SUBM', '1 NAME T',
        '0 @I1@ INDI', '1 NAME John /Doe/',
        '0 @I2@ INDI', '1 NAME Jane /Roe/',
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '2 _PREF Y',
        '1 WIFE @I2@',
        '0 TRLR',
      ].join('\n'),
    );
    const family = fam(dataset);
    expect(family.husband?.preferred).toBe(true);
    expect(family.wife?.preferred).toBeUndefined();
    const text = ser551(dataset);
    expect(text).toContain('2 _PREF Y');
    expect(ser70(dataset)).toContain('2 _PREF Y');
  });

  test('_FREL/_MREL under INDI.FAMC round-trip in 5.5.1 and project onto PEDI in 7.0', () => {
    const dataset = parseOk551(
      [
        '0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8',
        '0 @S1@ SUBM', '1 NAME T',
        '0 @I1@ INDI',
        '1 NAME Kid /Doe/',
        '1 FAMC @F1@',
        '2 _FREL adopted',
        '2 _MREL adopted',
        '0 @F1@ FAM',
        '0 TRLR',
      ].join('\n'),
    );
    const person = indi(dataset);
    expect(person.childFamilies?.[0]?.fatherRelation).toBe('adopted');
    expect(person.childFamilies?.[0]?.motherRelation).toBe('adopted');

    const text551 = ser551(dataset);
    expect(text551).toContain('2 _FREL adopted');
    expect(text551).toContain('2 _MREL adopted');
    expect(parseOk551(text551)).toEqual(dataset);

    // 7.0: the agreeing pair projects onto the link's own PEDI.
    const text70 = ser70(dataset);
    expect(text70).not.toContain('_FREL');
    expect(text70).not.toContain('_MREL');
    expect(text70).toContain('2 PEDI ADOPTED');
    const via70 = parseOk70(text70);
    expect(indi(via70).childFamilies?.[0]?.pedigree?.payload).toBe('ADOPTED');
  });

  test('_APID under events, attributes and names', () => {
    const dataset = parseOk551(
      [
        '0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8',
        '0 @S1@ SUBM', '1 NAME T',
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '2 _APID 1,7602::2771226',
        '1 BIRT',
        '2 DATE 12 MAR 1923',
        '2 _APID 1,7602::2771226',
        '1 OCCU Farmer',
        '2 _APID 1,7602::2771226',
        '0 TRLR',
      ].join('\n'),
    );
    const person = indi(dataset);
    expect(person.names?.[0]?.ancestryPointers).toEqual(['1,7602::2771226']);
    expect(person.events?.[0]?.detail?.ancestryPointers).toEqual(['1,7602::2771226']);
    expect(person.attributes?.[0]?.detail?.ancestryPointers).toEqual(['1,7602::2771226']);

    const text551 = ser551(dataset);
    expect(text551).toContain('2 _APID 1,7602::2771226');
    expect(parseOk551(text551)).toEqual(dataset);
    expect(ser70(dataset)).toContain('2 _APID 1,7602::2771226');
  });
});

describe('_DATE2 and the FTM201x facts', () => {
  const indi = (dataset: GedcomDataset): IndividualRecord => {
    const record = dataset.records.find((r) => r.tag === 'INDI');
    if (record === undefined) {
      throw new Error('expected INDI');
    }
    return record as IndividualRecord;
  };

  test('_DATE2 parses as the end date and round-trips in both versions', () => {
    const dataset = parseOk551(
      [
        '0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8',
        '0 @S1@ SUBM', '1 NAME T',
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '1 RESI',
        '2 DATE FROM 1950',
        '2 _DATE2 TO 1960',
        '0 TRLR',
      ].join('\n'),
    );
    const person = indi(dataset);
    expect(person.attributes?.[0]?.detail?.date?.value).toEqual({ kind: 'period', from: { calendar: 'GREGORIAN', year: 1950 } });
    expect(person.attributes?.[0]?.detail?.endDate?.value).toEqual({ kind: 'period', to: { calendar: 'GREGORIAN', year: 1960 } });

    const text551 = ser551(dataset);
    expect(text551).toContain('2 _DATE2 TO 1960');
    expect(parseOk551(text551)).toEqual(dataset);
    expect(ser70(dataset)).toContain('2 _DATE2 TO 1960');
    const via70 = parseOk70(ser70(dataset));
    expect(indi(via70).attributes?.[0]?.detail?.endDate?.value).toEqual(
      { kind: 'period', to: { calendar: 'GREGORIAN', year: 1960 } },
    );
  });

  test('the FTM201x facts normalize like the older FTM set', () => {
    const dataset = parseOk551(
      [
        '0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8',
        '0 @S1@ SUBM', '1 NAME T',
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '1 _CIRC',
        '2 DATE 1910',
        '1 _FUN',
        '1 _DEG B.A.',
        '1 _EMPLOY Merchant',
        '1 _DNA R1b-M269',
        '1 _NAMS John Senior',
        '1 _MILTID 123-45',
        '0 TRLR',
      ].join('\n'),
    );
    const person = indi(dataset);
    expect(person.events?.find((e) => e.tag === 'EVEN' && e.type === 'Circumcision')?.detail?.date?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', year: 1910 });
    expect(person.events?.some((e) => e.tag === 'EVEN' && e.type === 'Funeral')).toBe(true);
    expect(person.attributes?.find((a) => a.tag === 'EDUC')?.payload).toBe('B.A.');
    expect(person.attributes?.find((a) => a.tag === 'EDUC')?.type).toBe('Degree');
    expect(person.attributes?.find((a) => a.tag === 'FACT' && a.type === 'Employment')?.payload).toBe('Merchant');
    expect(person.attributes?.find((a) => a.tag === 'FACT' && a.type === 'DNA')?.payload).toBe('R1b-M269');
    expect(person.attributes?.find((a) => a.tag === 'FACT' && a.type === 'Namesake')?.payload).toBe('John Senior');
    expect(person.identifiers).toContainEqual({ tag: 'REFN', payload: '123-45', type: 'Military' });

    // The standard spellings come back; the vendor tags do not.
    const text = ser551(dataset);
    expect(text).toContain('2 TYPE Circumcision');
    expect(text).toContain('2 TYPE Funeral');
    expect(text).toContain('1 EDUC B.A.');
    expect(text).toContain('2 TYPE Degree');
    expect(text).toContain('2 TYPE Employment');
    expect(text).toContain('2 TYPE DNA');
    expect(text).toContain('2 TYPE Namesake');
    expect(text).toContain('1 REFN 123-45');
    expect(text).toContain('2 TYPE Military');
    expect(text).not.toContain('_CIRC');
    expect(text).not.toContain('_FUN');
    expect(text).not.toContain('_DEG');
    expect(text).not.toContain('_EMPLOY');
    expect(text).not.toContain('_DNA');
    expect(text).not.toContain('_NAMS');
    expect(text).not.toContain('_MILTID');
    expect(parseOk551(text)).toEqual(dataset);
  });
});

import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type {
  FamilyRecord,
  GedcomDataset,
  IndividualRecord,
  MultimediaRecord,
  SourceRecord,
} from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
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

function indi(dataset: GedcomDataset): IndividualRecord {
  const record = dataset.records.find((entry) => entry.tag === 'INDI');
  if (record === undefined || record.tag !== 'INDI') {
    throw new Error('expected INDI');
  }
  return record;
}

describe('the closed-list import fixes (webtrees registry)', () => {
  test('SOUR:MEDI (Legacy) types into SourceRecord.medium and writes back _MEDI', () => {
    const dataset = parseOk551([...H551, '0 @S2@ SOUR', '1 TITL A Book', '1 MEDI photo', ...SUBM, '0 TRLR'].join('\n'));
    const source = dataset.records.find((r): r is SourceRecord => r.tag === 'SOUR');
    expect(source?.medium).toBe('photo');
    expect(lines(ser551(dataset))).toContain('1 _MEDI photo');
    expect(lines(ser70(dataset))).toContain('1 _MEDI photo');
    expect(parseOk551(ser551(dataset)).records.find((r): r is SourceRecord => r.tag === 'SOUR')?.medium).toBe('photo');
    // The underscore spelling is accepted on 7.0 input too.
    const from70 = parseOk70([...H70, '0 @S2@ SOUR', '1 TITL A Book', '1 _MEDI photo', '0 TRLR'].join('\n'));
    expect(from70.records.find((r): r is SourceRecord => r.tag === 'SOUR')?.medium).toBe('photo');
  });

  test('FAM:RFN (Pro-Gen) types into the REFN identifier', () => {
    const dataset = parseOk551([...H551, '0 @F1@ FAM', '1 RFN 42', ...SUBM, '0 TRLR'].join('\n'));
    const fam = dataset.records.find((r): r is FamilyRecord => r.tag === 'FAM');
    expect(fam?.identifiers).toEqual([{ tag: 'REFN', payload: '42' }]);
    // Written back as the standard REFN (valid in both versions).
    expect(lines(ser551(dataset))).toContain('1 REFN 42');
    expect(lines(ser70(dataset))).toContain('1 REFN 42');
  });

  test('BIRT:TIME (Pro-Gen) attaches to the event DATE', () => {
    const dataset = parseOk551([...H551, '0 @I1@ INDI', '1 NAME A /B/', '1 BIRT', '2 DATE 1 JAN 1900', '2 TIME 10:30', ...SUBM, '0 TRLR'].join('\n'));
    const person = indi(dataset);
    const birth = person.events?.find((entry) => entry.tag === 'BIRT');
    // The DATE parses; the BIRT-level TIME (Pro-Gen's position, beside
    // DATE) attaches to the DATE.time slot (the standard position).
    expect(birth?.detail?.date?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', day: 1, month: 'JAN', year: 1900 });
    expect(birth?.detail?.date?.time).toEqual({ hour: 10, minute: 30 });
    expect(birth?.extensions).toBeUndefined();
  });

  test('a BIRT-level TIME without a parsed DATE stays a generic extension', () => {
    const dataset = parseOk551([...H551, '0 @I1@ INDI', '1 NAME A /B/', '1 BIRT', '2 TIME 10:30', ...SUBM, '0 TRLR'].join('\n'));
    const person = indi(dataset);
    const birth = person.events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.extensions).toContainEqual(expect.objectContaining({ tag: 'TIME', payload: '10:30' }));
  });
});

describe('the INDI SIGN conflict (USM6 versus Heredis)', () => {
  test('the USM6 flag spellings type into canSign', () => {
    for (const value of ['Y', 'YES', 'J', 'JA', '1']) {
      const dataset = parseOk551([...H551, '0 @I1@ INDI', `1 SIGN ${value}`, ...SUBM, '0 TRLR'].join('\n'));
      expect(indi(dataset).canSign, value).toBe(true);
    }
    for (const value of ['N', 'NO', 'NEIN', '0']) {
      const dataset = parseOk551([...H551, '0 @I1@ INDI', `1 SIGN ${value}`, ...SUBM, '0 TRLR'].join('\n'));
      expect(indi(dataset).canSign, value).toBe(false);
    }
  });

  test('a Heredis signature payload stays a generic extension instead of failing', () => {
    const dataset = parseOk551([...H551, '0 @I1@ INDI', '1 SIGN Jane Doe', ...SUBM, '0 TRLR'].join('\n'));
    const person = indi(dataset);
    expect(person.canSign).toBeUndefined();
    expect(person.extensions?.[0]).toMatchObject({ tag: 'SIGN', payload: 'Jane Doe' });
    // The underscore write-back spelling follows the same lenient rule.
    const underscored = parseOk551([...H551, '0 @I1@ INDI', '1 _SIGN John Hancock', ...SUBM, '0 TRLR'].join('\n'));
    expect(indi(underscored).extensions?.[0]).toMatchObject({ tag: '_SIGN', payload: 'John Hancock' });
  });
});

describe('the P8 Bürgerort import form (a payload-less FACT with a TYPE)', () => {
  test('1 FACT + TYPE Bürgerort + PLAC parses', () => {
    const dataset = parseOk551([...H551, '0 @I1@ INDI', '1 NAME A /B/', '1 FACT', '2 TYPE Bürgerort', '2 PLAC Meilen', ...SUBM, '0 TRLR'].join('\n'));
    const person = indi(dataset);
    const fact = person.attributes?.find((entry) => entry.tag === 'FACT');
    expect(fact?.tag === 'FACT' ? fact.payload : undefined).toBe('');
    expect(fact?.tag === 'FACT' ? fact.type : undefined).toBe('Bürgerort');
    expect(fact?.detail?.place?.payload).toEqual(['Meilen']);
  });
});

describe('the Ahnenblatt _ORGSOUR header block', () => {
  test('types and writes back NAME/VERS in both versions', () => {
    const dataset = parseOk551(['0 HEAD', '1 SOUR X', '1 _ORGSOUR', '2 NAME OldApp', '2 VERS 3.0', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', ...SUBM, '0 TRLR'].join('\n'));
    expect(dataset.header.originalSource).toEqual({ tag: '_ORGSOUR', name: 'OldApp', version: '3.0' });
    const out551 = ser551(dataset);
    expect(lines(out551)).toContain('1 _ORGSOUR');
    expect(lines(out551)).toContain('2 NAME OldApp');
    expect(lines(out551)).toContain('2 VERS 3.0');
    const out70 = ser70(dataset);
    expect(lines(out70)).toContain('1 _ORGSOUR');
    expect(lines(out70)).toContain('2 NAME OldApp');
  });
});

describe('the FTM _FA1–_FA13 user facts', () => {
  const SCHEMA = ['1 SCHEMA', '2 INDI', '3 _FA1', '4 LABL Occupation history', '2 FAM', '3 _FA2', '4 LABL Farm name'];

  test('INDI facts resolve their TYPE from the HEAD.SCHEMA label', () => {
    const dataset = parseOk551(['0 HEAD', '1 SOUR X', ...SCHEMA, '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '0 @I1@ INDI', '1 _FA1 Master carpenter', '1 _FA3 Peasant', ...SUBM, '0 TRLR'].join('\n'));
    const person = indi(dataset);
    const first = person.attributes?.find((entry) => entry.tag === 'FACT' && entry.type === 'Occupation history');
    expect(first?.payload).toBe('Master carpenter');
    // _FA3 has no schema label; the fallback is the ordinal.
    expect(person.attributes?.find((entry) => entry.tag === 'FACT' && entry.type === 'Fact 3')?.payload).toBe('Peasant');
  });

  test('FAM facts become FAM EVEN with the schema label', () => {
    const dataset = parseOk551(['0 HEAD', '1 SOUR X', ...SCHEMA, '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '0 @F1@ FAM', '1 _FA2 Oberhof', ...SUBM, '0 TRLR'].join('\n'));
    const fam = dataset.records.find((r): r is FamilyRecord => r.tag === 'FAM');
    expect(fam?.events?.find((entry) => entry.tag === 'EVEN' && entry.type === 'Farm name')?.payload).toBe('Oberhof');
  });
});

describe('the FO7 _CORR correspondence block', () => {
  test('types and writes back REAS/RESP/RPLY in both versions', () => {
    const dataset = parseOk551([...H551, '0 @I1@ INDI', '1 _CORR', '2 REAS Asking', '2 RESP Answered', '2 RPLY Y', ...SUBM, '0 TRLR'].join('\n'));
    expect(indi(dataset).correspondence).toEqual({ tag: '_CORR', reason: 'Asking', response: 'Answered', replyStatus: 'Y' });
    const out = lines(ser551(dataset));
    expect(out).toContain('1 _CORR');
    expect(out).toContain('2 REAS Asking');
    expect(out).toContain('2 RESP Answered');
    expect(out).toContain('2 RPLY Y');
    expect(parseOk551(ser551(dataset)).records.find((r) => r.tag === 'INDI')).toEqual(indi(dataset));
  });
});

describe('the AF2000 _DIVERSES container', () => {
  test('normalizes into a FACT with the TITL type and the NOTE payload', () => {
    const dataset = parseOk551([...H551, '0 @I1@ INDI', '1 _DIVERSES', '2 TITL Remarks', '2 NOTE Some text', ...SUBM, '0 TRLR'].join('\n'));
    const fact = indi(dataset).attributes?.find((entry) => entry.tag === 'FACT');
    expect(fact?.tag === 'FACT' ? fact.type : undefined).toBe('Remarks');
    expect(fact?.tag === 'FACT' ? fact.payload : undefined).toBe('Some text');
  });
});

describe('the BKW6 FAM _PRMN permanent number', () => {
  test('types into the FAM REFN identifier', () => {
    const dataset = parseOk551([...H551, '0 @F1@ FAM', '1 _PRMN 12345', ...SUBM, '0 TRLR'].join('\n'));
    const fam = dataset.records.find((r): r is FamilyRecord => r.tag === 'FAM');
    expect(fam?.identifiers).toEqual([{ tag: 'REFN', payload: '12345' }]);
    expect(lines(ser551(dataset))).toContain('1 REFN 12345');
  });
});

describe('the phpGedView _HEB names', () => {
  test('types under NAME and PLAC and writes back in both versions', () => {
    const dataset = parseOk551([...H551, '0 @I1@ INDI', '1 NAME Moshe /Cohen/', '2 _HEB משה כהן', '1 BIRT', '2 PLAC Vilnius', '3 _HEB וילנה', ...SUBM, '0 TRLR'].join('\n'));
    const person = indi(dataset);
    expect(person.names?.[0]?.hebrewName).toBe('משה כהן');
    expect(person.events?.[0]?.detail?.place?.hebrewName).toBe('וילנה');
    const out551 = lines(ser551(dataset));
    expect(out551).toContain('2 _HEB משה כהן');
    expect(out551).toContain('3 _HEB וילנה');
    expect(lines(ser70(dataset))).toContain('2 _HEB משה כהן');
  });
});

describe('URL as a synonym for WWW under an address (5.5.5 recommendation)', () => {
  test('types into the address www slot', () => {
    const dataset = parseOk551([...H551, '0 @R1@ REPO', '1 NAME R', '1 ADDR Street', '2 CONT City', '2 CITY City', '2 URL https://example.com/repo', ...SUBM, '0 TRLR'].join('\n'));
    const repo = dataset.records.find((r) => r.tag === 'REPO');
    expect(repo?.tag === 'REPO' ? repo.address?.www : undefined).toEqual(['https://example.com/repo']);
  });
});

describe('the historical 5.5EL _LOC spellings', () => {
  test('POST and NAME._LANG type into the GEDCOM-L slots', () => {
    const dataset = parseOk551([...H551, '0 @P1@ _LOC', '1 NAME Mainz', '2 _LANG de', '1 POST 55116', ...SUBM, '0 TRLR'].join('\n'));
    const place = dataset.records.find((r) => r.tag === '_PLAC');
    expect(place?.tag === '_PLAC' ? place.names?.[0]?.language : undefined).toBe('de');
    expect(place?.tag === '_PLAC' ? place.postalCodes?.[0]?.code : undefined).toBe('55116');
    // The write-back uses the GEDCOM-L spellings.
    const out = lines(ser551(dataset));
    expect(out).toContain('2 LANG de');
    expect(out).toContain('1 _POST 55116');
  });
});

describe('the Family Historian media attributes', () => {
  test('_KEYS/_FILE/_NOTE on the record and _SEQ/_AREA/_EXCL/_CAPT on the link', () => {
    const dataset = parseOk551([
      ...H551,
      '0 @O1@ OBJE',
      '1 FILE photo.jpg',
      '2 FORM jpg',
      '1 _KEYS portrait, 1920',
      '1 _FILE /pics/photo.jpg',
      '1 _NOTE faded corners',
      '0 @I1@ INDI',
      '1 OBJE @O1@',
      '2 _SEQ 2',
      '2 _AREA {top:10,left:20,bottom:100,right:200}',
      '2 _EXCL ALL',
      '2 _CAPT Y',
      ...SUBM,
      '0 TRLR',
    ].join('\n'));
    const media = dataset.records.find((r): r is MultimediaRecord => r.tag === 'OBJE');
    expect(media?.keywords).toBe('portrait, 1920');
    expect(media?.filePath).toBe('/pics/photo.jpg');
    expect(media?.mediaNote).toBe('faded corners');
    const link = indi(dataset).media?.[0];
    expect(link?.sequence).toBe(2);
    expect(link?.area).toBe('{top:10,left:20,bottom:100,right:200}');
    expect(link?.excludeFromDiagrams).toBe(true);
    expect(link?.caption).toBe(true);
    const out = lines(ser551(dataset));
    expect(out).toContain('1 _KEYS portrait, 1920');
    expect(out).toContain('1 _FILE /pics/photo.jpg');
    expect(out).toContain('1 _NOTE faded corners');
    expect(out).toContain('2 _SEQ 2');
    expect(out).toContain('2 _AREA {top:10,left:20,bottom:100,right:200}');
    expect(out).toContain('2 _EXCL ALL');
    expect(out).toContain('2 _CAPT Y');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });
});

describe('the Ancestry OBJE:_CREA creation date', () => {
  test('types into MultimediaRecord.createdAt', () => {
    const dataset = parseOk551([...H551, '0 @O1@ OBJE', '1 FILE photo.jpg', '2 FORM jpeg', '1 _CREA 5 MAR 2020', ...SUBM, '0 TRLR'].join('\n'));
    const media = dataset.records.find((r): r is MultimediaRecord => r.tag === 'OBJE');
    expect(media?.createdAt).toBe('5 MAR 2020');
    expect(lines(ser551(dataset))).toContain('1 _CREA 5 MAR 2020');
  });
});

describe('the SCHMA alias table', () => {
  test('a documented tag naming g7:PAGE resolves to the standard structure', () => {
    const dataset = parseOk70([
      ...H70,
      '1 SCHMA',
      '2 TAG _PAGE https://gedcom.io/terms/v7/PAGE',
      '0 @S2@ SOUR',
      '1 TITL Book',
      '0 @I1@ INDI',
      '1 SOUR @S2@',
      '2 _PAGE 42',
      '0 TRLR',
    ].join('\n'));
    const person = indi(dataset);
    expect(person.citations?.[0]?.page).toEqual({ tag: 'PAGE', payload: '42' });
    // The write-back uses the standard spelling.
    expect(lines(ser70(dataset))).toContain('2 PAGE 42');
  });

  test('a documented tag naming g7:QUAY resolves to the standard structure', () => {
    const dataset = parseOk70([
      ...H70,
      '1 SCHMA',
      '2 TAG _Q https://gedcom.io/terms/v7/QUAY',
      '0 @S2@ SOUR',
      '1 TITL Book',
      '0 @I1@ INDI',
      '1 SOUR @S2@',
      '2 _Q 1',
      '0 TRLR',
    ].join('\n'));
    expect(indi(dataset).citations?.[0]?.quality).toBe('1');
  });
});

describe('the 5.5.1 export of BCE dates with a month', () => {
  test('falls back to the parenthesized date phrase (valid 5.5.1)', () => {
    const dataset = parseOk70([...H70, '0 @I1@ INDI', '1 BIRT', '2 DATE 1 JAN 1700 BCE', '0 TRLR'].join('\n'));
    const out = ser551(dataset);
    expect(lines(out)).toContain('2 DATE (1 JAN 1700 BCE)');
    // The output re-parses without an error and keeps the text.
    const reparsed = parseOk551(out);
    const birth = indi(reparsed).events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.date?.phrase).toBe('1 JAN 1700 BCE');
  });

  test('the 7.0 export keeps the epoch on the month-bearing date', () => {
    const dataset = parseOk70([...H70, '0 @I1@ INDI', '1 BIRT', '2 DATE 1 JAN 1700 BCE', '0 TRLR'].join('\n'));
    expect(lines(ser70(dataset))).toContain('2 DATE 1 JAN 1700 BCE');
  });

  test('a year-only epoch still writes the 5.5.1 B.C. spelling', () => {
    const dataset = parseOk70([...H70, '0 @I1@ INDI', '1 BIRT', '2 DATE 1700 BCE', '0 TRLR'].join('\n'));
    expect(lines(ser551(dataset))).toContain('2 DATE 1700 B.C.');
  });
});

describe('the SUBN _IMPF write-back', () => {
  test('the import reference of the submission record is emitted', () => {
    const dataset = parseOk551([...H551, '0 @N1@ SUBN', '1 SUBM @S1@', '1 FAMF F', '1 _IMPF @N9@', '2 PAGE file-1', ...SUBM, '0 TRLR'].join('\n'));
    const out = lines(ser551(dataset));
    expect(out).toContain('0 @N1@ SUBN');
    expect(out).toContain('1 _IMPF @@N9@@');
    expect(out).toContain('2 PAGE file-1');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });
});

describe('the GEDCOM 5.5 embedded-multimedia record shape', () => {  const EMBEDDED = [...H551, '0 @O1@ OBJE', '1 FORM gif', '1 TITL The picture', '0 @I1@ INDI', '1 NAME A /B/', '1 OBJE @O1@', ...SUBM, '0 TRLR'].join('\n');

  test('parses on 5.x input (no FILE required for the 5.5 shape)', () => {
    const dataset = parseOk551(EMBEDDED);
    const media = dataset.records.find((r) => r.tag === 'OBJE');
    expect(media?.tag === 'OBJE' ? media.files.length : -1).toBe(0);
    expect(media?.tag === 'OBJE' ? media.extensions?.map((e) => e.tag) : undefined).toEqual(['FORM']);
    // The TITL types into the record title.
    expect(media?.tag === 'OBJE' ? media.title : undefined).toBe('The picture');
  });

  test('the record is dropped entirely on 5.5.1 export, links stripped', () => {
    const dataset = parseOk551(EMBEDDED);
    const text = ser551(dataset);
    expect(text).not.toContain('@O1@ OBJE');
    expect(text).not.toContain('1 FORM gif');
    expect(text).not.toContain('1 OBJE @O1@');
  });

  test('the record is dropped entirely on 7.0 export, links stripped', () => {
    const dataset = parseOk551(EMBEDDED);
    const text = ser70(dataset);
    expect(text).not.toContain('@O1@ OBJE');
    expect(text).not.toContain('1 FORM gif');
    expect(text).not.toContain('1 OBJE @O1@');
  });
});

describe('the free-text SOUR citation vendor children', () => {
  test('_QUAY, _FIELD and _RINI survive the 5.5.1 export', () => {
    const dataset = parseOk551([
      ...H551,
      '0 @I1@ INDI',
      '1 BIRT',
      '2 SOUR free-text source',
      '3 _QUAY 0x98',
      '3 _FIELD TX-PAGE',
      '4 TEXT Page 321',
      '3 _RINI J. Finder',
      ...SUBM,
      '0 TRLR',
    ].join('\n'));
    const out = lines(ser551(dataset));
    expect(out).toContain('2 SOUR free-text source');
    expect(out).toContain('3 _QUAY 0x98');
    expect(out).toContain('3 _FIELD TX-PAGE');
    expect(out).toContain('4 TEXT Page 321');
    expect(out).toContain('3 _RINI J. Finder');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });
});

describe('the 2026-11 tail: Legacy marriage report fields, Aldfaer birth data, phpGedView CEME, event creation dates', () => {
  test('the Legacy FAM.MARR report labels and phrases round-trip in both versions', () => {
    const dataset = parseOk551([...H551, '0 @F1@ FAM', '1 MARR', '2 _HTITL The groom', '2 _WTITL The bride', '2 _RPT_PHRS First phrase', '2 _RPT_PHRS2 Second phrase', ...SUBM, '0 TRLR'].join('\n'));
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    const marr = fam?.tag === 'FAM' ? fam.events?.[0] : undefined;
    expect(marr?.tag === 'MARR' ? marr.husbandLabel : undefined).toBe('The groom');
    expect(marr?.tag === 'MARR' ? marr.wifeLabel : undefined).toBe('The bride');
    expect(marr?.tag === 'MARR' ? marr.reportPhrases : undefined).toEqual(['First phrase', 'Second phrase']);
    const out = lines(ser551(dataset));
    expect(out).toContain('2 _HTITL The groom');
    expect(out).toContain('2 _WTITL The bride');
    expect(out).toContain('2 _RPT_PHRS First phrase');
    expect(out).toContain('2 _RPT_PHRS2 Second phrase');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
    // The 7.0 export spells the same underscore tags (extension tags
    // are valid in both versions); the fields survive the round trip.
    const reparsed70 = parseOk70(ser70(dataset));
    const fam70 = reparsed70.records.find((r) => r.tag === 'FAM');
    const marr70 = fam70?.tag === 'FAM' ? fam70.events?.[0] : undefined;
    expect(marr70?.tag === 'MARR' ? marr70.husbandLabel : undefined).toBe('The groom');
    expect(marr70?.tag === 'MARR' ? marr70.reportPhrases : undefined).toEqual(['First phrase', 'Second phrase']);
  });

  test('the Aldfaer birth length and weight type under BIRT', () => {
    const dataset = parseOk551([...H551, '0 @I1@ INDI', '1 NAME A /B/', '1 BIRT', '2 _LENGTH 52 cm', '2 _WEIGHT 3900 g', ...SUBM, '0 TRLR'].join('\n'));
    const birth = indi(dataset).events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.birthLength).toBe('52 cm');
    expect(birth?.detail?.birthWeight).toBe('3900 g');
    const out = lines(ser551(dataset));
    expect(out).toContain('2 _LENGTH 52 cm');
    expect(out).toContain('2 _WEIGHT 3900 g');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });

  test('the Aldfaer time under BIRT attaches to the date TIME slot', () => {
    const dataset = parseOk551([...H551, '0 @I1@ INDI', '1 NAME A /B/', '1 BIRT', '2 DATE 1 JAN 1900', '2 _ALDFAER_TIME 10:30', ...SUBM, '0 TRLR'].join('\n'));
    const birth = indi(dataset).events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.date?.time).toEqual({ hour: 10, minute: 30 });
    // The write-back uses the standard DATE.TIME spelling.
    const out = lines(ser551(dataset));
    expect(out).toContain('2 DATE 1 JAN 1900');
    expect(out).toContain('3 TIME 10:30');
    expect(out).not.toContain('_ALDFAER_TIME');
  });

  test('the Aldfaer time without a DATE stays a generic extension', () => {
    const dataset = parseOk551([...H551, '0 @I1@ INDI', '1 NAME A /B/', '1 DEAT', '2 _ALDFAER_TIME 22:00', ...SUBM, '0 TRLR'].join('\n'));
    const death = indi(dataset).events?.find((entry) => entry.tag === 'DEAT');
    expect(death?.detail?.extensions).toContainEqual(expect.objectContaining({ tag: '_ALDFAER_TIME', payload: '22:00' }));
    expect(lines(ser551(dataset))).toContain('2 _ALDFAER_TIME 22:00');
  });

  test('the phpGedView CEME under BURI types into the cemetery slot', () => {
    const dataset = parseOk551([...H551, '0 @I1@ INDI', '1 NAME A /B/', '1 BURI', '2 CEME Old Cemetery', ...SUBM, '0 TRLR'].join('\n'));
    const burial = indi(dataset).events?.find((entry) => entry.tag === 'BURI');
    expect(burial?.detail?.cemetery).toBe('Old Cemetery');
    // The write-back uses the underscore spelling.
    const out = lines(ser551(dataset));
    expect(out).toContain('2 _CEME Old Cemetery');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
    // The non-underscore spelling is accepted in any file.
    const as70 = parseGedcom70(enc([...H70, '0 @I1@ INDI', '1 BURI', '2 CEME x', '0 TRLR'].join('\n')));
    expect(as70.ok).toBe(true);
    if (as70.ok) {
      const burial70 = (as70.value.records[0] as { events?: Array<{ detail?: { cemetery?: string } }> }).events?.[0];
      expect(burial70?.detail?.cemetery).toBe('x');
    }
  });

  test('the event creation dates type into EventDetail.createdAt', () => {
    const dataset = parseOk551([...H551, '0 @I1@ INDI', '1 NAME A /B/', '1 BIRT', '2 _CRE 12 JUN 2020', ...SUBM, '0 TRLR'].join('\n'));
    const birth = indi(dataset).events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.createdAt).toBe('12 JUN 2020');
    // The canonical write-back spelling is _CREAT.
    expect(lines(ser551(dataset))).toContain('2 _CREAT 12 JUN 2020');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });
});

describe('the MyHeritage export metadata and the Généatique _THUM flag', () => {
  test('the HEAD metadata types and round-trips', () => {
    const dataset = parseOk551([
      '0 HEAD',
      '1 SOUR MyHeritage.com',
      '2 _RTLSAVE RTL',
      '1 DEST MYHERITAGE',
      '1 DATE 8 APR 2022',
      '2 TIME 14:08:36',
      '2 _TIMEZONE GMT+-0',
      '1 _PROJECT_GUID 35179D7C-Q194-2E5R-5D56-5D5662C417V9',
      '1 _EXPORTED_FROM_SITE_ID 265024761',
      '1 _RINS I224,F94,N0,M0,R0,S0,U2,L0,P0,Q0,IF480,FF69',
      '1 _DESCRIPTION_AWARE Y',
      '1 SUBM @S1@',
      '1 GEDC',
      '2 VERS 5.5.1',
      '2 FORM LINEAGE-LINKED',
      '1 CHAR UTF-8',
      ...SUBM,
      '0 TRLR',
    ].join('\n'));
    expect(dataset.header.projectGuid).toBe('35179D7C-Q194-2E5R-5D56-5D5662C417V9');
    expect(dataset.header.exportedFromSiteId).toBe('265024761');
    expect(dataset.header.recordCounts).toBe('I224,F94,N0,M0,R0,S0,U2,L0,P0,Q0,IF480,FF69');
    expect(dataset.header.descriptionAware).toBe(true);
    expect(dataset.header.timezone).toBe('GMT+-0');
    expect(dataset.header.source?.rtlSave).toBe('RTL');
    const out = lines(ser551(dataset));
    expect(out).toContain('1 _PROJECT_GUID 35179D7C-Q194-2E5R-5D56-5D5662C417V9');
    expect(out).toContain('1 _EXPORTED_FROM_SITE_ID 265024761');
    expect(out).toContain('1 _RINS I224,F94,N0,M0,R0,S0,U2,L0,P0,Q0,IF480,FF69');
    expect(out).toContain('1 _DESCRIPTION_AWARE Y');
    expect(out).toContain('2 _TIMEZONE GMT+-0');
    expect(out).toContain('2 _RTLSAVE RTL');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });

  test('the _PUBLISH record types and round-trips', () => {
    const dataset = parseOk551([...H551, '0 _PUBLISH', '1 _SITEADDRESS ferreiramouraborges', '1 _SITENAME Ferreira Moura Borges', '1 _SITEID 255552541', '1 _USERNAME jlborges@@fe.up.pt', '1 _DISABLED Y', ...SUBM, '0 TRLR'].join('\n'));
    const record = dataset.records.find((r) => r.tag === '_PUBLISH');
    expect(record).toMatchObject({
      tag: '_PUBLISH',
      siteAddress: 'ferreiramouraborges',
      siteName: 'Ferreira Moura Borges',
      siteId: '255552541',
      username: 'jlborges@fe.up.pt',
      disabled: true,
    });
    const out = lines(ser551(dataset));
    expect(out).toContain('0 _PUBLISH');
    expect(out).toContain('1 _SITEID 255552541');
    expect(out).toContain('1 _DISABLED Y');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
    expect(lines(ser70(dataset))).toContain('0 _PUBLISH');
  });

  test('the Généatique _THUM flag types on the media link', () => {
    const dataset = parseOk551([...H551, '0 @O1@ OBJE', '1 FILE media/pic.jpg', '2 FORM jpg', '0 @I1@ INDI', '1 NAME A /B/', '1 OBJE @O1@', '2 _THUM Y', ...SUBM, '0 TRLR'].join('\n'));
    const link = indi(dataset).media?.[0];
    expect(link?.thumbnail).toBe(true);
    expect(lines(ser551(dataset))).toContain('2 _THUM Y');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });
});

describe('the FTM citation _LINK and the FTB/MyHeritage media attributes', () => {
  test('_LINK under a citation types and round-trips in both versions', () => {
    const dataset = parseOk551([...H551, '0 @S2@ SOUR', '1 TITL Book', '0 @I1@ INDI', '1 NAME A /B/', '1 BIRT', '2 SOUR @S2@', '3 _LINK http://gedcom4j.org', ...SUBM, '0 TRLR'].join('\n'));
    const birth = indi(dataset).events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.citations?.[0]?.links).toEqual(['http://gedcom4j.org']);
    const out = lines(ser551(dataset));
    expect(out).toContain('3 _LINK http://gedcom4j.org');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
    expect(lines(ser70(dataset))).toContain('3 _LINK http://gedcom4j.org');
  });

  test('the FTB/MyHeritage media attributes type on the inline OBJE file', () => {
    const dataset = parseOk551([
      ...H551,
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 OBJE',
      '2 FORM jpg',
      '2 FILE https://example.com/doc.jpg',
      '2 _FILESIZE 406254',
      '2 TITL A document',
      '2 _ALBUM @A999988@',
      '2 _PHOTO_RIN MH:P500064',
      ...SUBM,
      '0 TRLR',
    ].join('\n'));
    const media = dataset.records.find((r) => r.tag === 'OBJE');
    const file = media?.tag === 'OBJE' ? media.files[0] : undefined;
    expect(file?.fileSize).toBe(406254);
    expect(file?.album).toBe('@A999988@');
    expect(file?.recordId).toBe('MH:P500064');
    const out = lines(ser551(dataset));
    expect(out).toContain('1 _FILESIZE 406254');
    expect(out).toContain('1 _ALBUM @A999988@');
    expect(out).toContain('1 _PHOTO_RIN MH:P500064');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });

  test('the FTB media attributes type on the OBJE record too', () => {
    const dataset = parseOk551([...H551, '0 @O1@ OBJE', '1 FILE doc.jpg', '2 FORM jpg', '1 _FILESIZE 1024', '1 _ALBUM @A1@', '1 _PHOTO_RIN MH:P1', ...SUBM, '0 TRLR'].join('\n'));
    const media = dataset.records.find((r) => r.tag === 'OBJE');
    const file = media?.tag === 'OBJE' ? media.files[0] : undefined;
    expect(file?.fileSize).toBe(1024);
    expect(file?.album).toBe('@A1@');
    expect(file?.recordId).toBe('MH:P1');
    const out = lines(ser551(dataset));
    expect(out).toContain('1 _FILESIZE 1024');
    expect(out).toContain('1 _ALBUM @A1@');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });
});

import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset, MultimediaRecord } from '../src/structures';

// Typing coverage for the third corpus round: the Ancestry.com Family
// Trees media-record block (_OID/_USER/_ENCR/_ORIG/_ATL/_META/_CLON
// under OBJE) and the RIN repeated under events. Each case parses,
// round-trips model-stably and writes the canonical spelling.

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

const HEAD551 = [
  '0 HEAD',
  '1 SOUR X',
  '1 SUBM @S1@',
  '1 GEDC',
  '2 VERS 5.5.1',
  '2 FORM LINEAGE-LINKED',
  '1 CHAR UTF-8',
  '0 @S1@ SUBM',
  '1 NAME T',
].join('\n');

const H70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0'];

// The real shape of an Ancestry.com Family Trees media record (the
// GEDCOM.NET test tree, JasonRawlins/Gedcom, GedcomNetTestTree.ged),
// trimmed to the typed block plus the standard siblings.
const ANCESTRY_OBJE = [
  '0 @O1@ OBJE',
  '1 FILE',
  '2 FORM jpg',
  '3 _MTYPE portrait',
  '3 _STYPE jpeg',
  '3 _SIZE 23587',
  '3 _WDTH 333',
  '3 _HGHT 333',
  '2 TITL Dylan Davis (Ancestry media: Details)',
  '1 _OID 63358182-7695-45e1-94e0-3c7e185a0767',
  '1 _DSCR (Ancestry media: Description)',
  '1 _META <metadataxml><acountry></acountry><branch></branch><cemetery></cemetery>',
  '2 CONC n></metadataxml>',
  '1 _CREA 2026-01-22 19:12:00.407',
  '1 _USER QixXDc6beOI/csSm7ylIrofE0YCRu9OpidbrAGCnO9XiGbRY20Z3i6wkKw9LzmqoFYyje1QjPpgQ1Ezq1fXApQ=',
  '2 _ENCR 1',
  '1 _ORIG acom',
  '1 _ATL Y',
  '1 _MSER',
  '2 _LKID 63358182-7695-45e1-94e0-3c7e185a0767',
  '1 _CLON',
  '2 _TID 77554670',
  '2 _PID 342301753767',
  '2 _OID 25dd2b86-a529-4e1b-9bba-c0c2adb423ab',
  '2 _USER g1vPaD+r8dL8ZzDkbz+DD/x4+pt4zoTwe85Bx8SJpjIv73jTArSLihQo6dmcloAgJikvzRgGtus2/jfJ',
  '3 _ENCR 1',
  '2 _DATE 2021-06-10 22:19:18.000',
].join('\n');

function obje(text: string): MultimediaRecord {
  const dataset = parseOk551(text);
  const record = dataset.records.find((r) => r.tag === 'OBJE');
  if (record?.tag !== 'OBJE') {
    throw new Error('expected OBJE');
  }
  return record;
}

describe('Ancestry.com Family Trees media-record block', () => {
  test('types the _OID/_USER/_ENCR/_ORIG/_ATL/_META/_CLON block', () => {
    const rec = obje([HEAD551, ANCESTRY_OBJE, '0 TRLR', ''].join('\n'));
    expect(rec.objectId).toBe('63358182-7695-45e1-94e0-3c7e185a0767');
    expect(rec.user).toBe('QixXDc6beOI/csSm7ylIrofE0YCRu9OpidbrAGCnO9XiGbRY20Z3i6wkKw9LzmqoFYyje1QjPpgQ1Ezq1fXApQ=');
    expect(rec.userEncrypted).toBe(true);
    expect(rec.origin).toBe('acom');
    expect(rec.attachment).toBe(true);
    // CONC is merged into the value.
    expect(rec.metadata).toBe(
      '<metadataxml><acountry></acountry><branch></branch><cemetery></cemetery>n></metadataxml>',
    );
    // _DSCR types into the description slot.
    expect(rec.description).toBe('(Ancestry media: Description)');
    expect(rec.extensions?.some((ext) => ext.tag === '_DSCR') ?? false).toBe(false);
    expect(rec.clones).toHaveLength(1);
    expect(rec.clones?.[0]).toMatchObject({
      tag: '_CLON',
      treeId: '77554670',
      personId: '342301753767',
      objectId: '25dd2b86-a529-4e1b-9bba-c0c2adb423ab',
      user: 'g1vPaD+r8dL8ZzDkbz+DD/x4+pt4zoTwe85Bx8SJpjIv73jTArSLihQo6dmcloAgJikvzRgGtus2/jfJ',
      userEncrypted: true,
      date: '2021-06-10 22:19:18.000',
    });
  });

  test('types the FORM metadata block (_MTYPE/_STYPE/_SIZE/_WDTH/_HGHT) and the _MSER/_LKID pair', () => {
    const rec = obje([HEAD551, ANCESTRY_OBJE, '0 TRLR', ''].join('\n'));
    const form = rec.files[0]?.form;
    expect(form).toMatchObject({
      payload: 'jpg',
      kind: 'portrait',
      storageType: 'jpeg',
      size: 23587,
      width: 333,
      height: 333,
    });
    expect(rec.master).toBe(true);
    expect(rec.masterLinkId).toBe('63358182-7695-45e1-94e0-3c7e185a0767');
  });

  test('the FORM metadata and the _MSER/_LKID pair round-trip in 5.5.1', () => {
    const dataset = parseOk551([HEAD551, ANCESTRY_OBJE, '0 TRLR', ''].join('\n'));
    const serialized = ser551(dataset);
    expect(serialized).toContain('3 _MTYPE portrait');
    expect(serialized).toContain('3 _STYPE jpeg');
    expect(serialized).toContain('3 _SIZE 23587');
    expect(serialized).toContain('3 _WDTH 333');
    expect(serialized).toContain('3 _HGHT 333');
    expect(serialized).toContain('1 _MSER');
    expect(serialized).toContain('2 _LKID 63358182-7695-45e1-94e0-3c7e185a0767');
    expect(serialized).toContain('1 _DSCR (Ancestry media: Description)');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_MSER with unknown children keeps them as extensions', () => {
    const rec = obje(
      [HEAD551, '0 @O1@ OBJE', '1 FILE', '2 FORM jpg', '1 _MSER', '2 _LKID abc', '2 _BOGUS x', '0 TRLR', ''].join('\n'),
    );
    expect(rec.master).toBe(true);
    expect(rec.masterLinkId).toBe('abc');
    expect(rec.extensions?.some((ext) => ext.tag === '_BOGUS')).toBe(true);
  });

  test('round-trips 5.5.1 model-stably with the canonical spelling', () => {
    const dataset = parseOk551([HEAD551, ANCESTRY_OBJE, '0 TRLR', ''].join('\n'));
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _OID 63358182-7695-45e1-94e0-3c7e185a0767');
    expect(serialized).toContain('1 _USER QixXDc6beOI');
    expect(serialized).toContain('2 _ENCR 1');
    expect(serialized).toContain('1 _ORIG acom');
    expect(serialized).toContain('1 _ATL Y');
    expect(serialized).toContain('1 _META <metadataxml>');
    expect(serialized).toContain('1 _CLON');
    expect(serialized).toContain('2 _TID 77554670');
    expect(serialized).toContain('2 _PID 342301753767');
    expect(serialized).toContain('2 _OID 25dd2b86-a529-4e1b-9bba-c0c2adb423ab');
    expect(serialized).toContain('2 _DATE 2021-06-10 22:19:18.000');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_ATL N parses as false (and is not re-emitted)', () => {
    const rec = obje([HEAD551, '0 @O1@ OBJE', '1 FILE', '2 FORM jpg', '1 _ATL N', '0 TRLR', ''].join('\n'));
    expect(rec.attachment).toBe(false);
    const serialized = ser551(
      parseOk551([HEAD551, '0 @O1@ OBJE', '1 FILE', '2 FORM jpg', '1 _ATL N', '0 TRLR', ''].join('\n')),
    );
    expect(serialized).not.toContain('_ATL');
  });

  test('_ENCR 0 clears the flag; a bare _ENCR marks it', () => {
    const cleared = obje(
      [HEAD551, '0 @O1@ OBJE', '1 FILE', '2 FORM jpg', '1 _USER abc', '2 _ENCR 0', '0 TRLR', ''].join('\n'),
    );
    expect(cleared.userEncrypted).toBe(false);
    const bare = obje(
      [HEAD551, '0 @O1@ OBJE', '1 FILE', '2 FORM jpg', '1 _USER abc', '2 _ENCR', '0 TRLR', ''].join('\n'),
    );
    expect(bare.userEncrypted).toBe(true);
  });

  test('unknown children of _USER and _CLON stay extensions', () => {
    const rec = obje(
      [
        HEAD551,
        '0 @O1@ OBJE',
        '1 FILE',
        '2 FORM jpg',
        '1 _USER abc',
        '2 _ENCR 1',
        '2 _BOGUS x',
        '1 _CLON',
        '2 _TID 1',
        '2 _BOGUS2 y',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    expect(rec.userEncrypted).toBe(true);
    expect(rec.extensions?.some((ext) => ext.tag === '_BOGUS')).toBe(true);
    expect(rec.clones?.[0]?.extensions?.some((ext) => ext.tag === '_BOGUS2')).toBe(true);
  });

  test('the block parses under the 7.0 multimedia record too', () => {
    const dataset = parseOk70(
      [
        ...H70,
        '0 @O1@ OBJE',
        '1 FILE',
        '2 FORM image/jpeg',
        '1 _OID 63358182-7695-45e1-94e0-3c7e185a0767',
        '1 _USER abc',
        '2 _ENCR 1',
        '1 _ORIG acom',
        '1 _ATL Y',
        '1 _META <metadataxml/>',
        '1 _CLON',
        '2 _TID 77554670',
        '2 _PID 342301753767',
        '2 _OID 25dd2b86-a529-4e1b-9bba-c0c2adb423ab',
        '2 _USER ghi',
        '3 _ENCR 1',
        '2 _DATE 2021-06-10 22:19:18.000',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const rec = dataset.records.find((r) => r.tag === 'OBJE');
    if (rec?.tag !== 'OBJE') {
      throw new Error('expected OBJE');
    }
    expect(rec.objectId).toBe('63358182-7695-45e1-94e0-3c7e185a0767');
    expect(rec.userEncrypted).toBe(true);
    expect(rec.origin).toBe('acom');
    expect(rec.attachment).toBe(true);
    expect(rec.clones?.[0]?.treeId).toBe('77554670');
    // The vendor block is written back in 7.0 too.
    const serialized = ser70(dataset);
    expect(serialized).toContain('1 _OID 63358182-7695-45e1-94e0-3c7e185a0767');
    expect(serialized).toContain('1 _CLON');
    expect(parseOk70(serialized)).toEqual(dataset);
  });
});

describe('RIN under events (Ancestry.com Family Trees)', () => {
  test('parses and round-trips in 5.5.1', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 BIRT',
        '2 DATE 7 JUL 1930',
        '2 RIN 789654123',
        '1 DEAT',
        '2 RIN 789654123',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.automatedRecordId).toBe('789654123');
    expect(indi.events?.[1]?.detail?.automatedRecordId).toBe('789654123');
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 RIN 789654123');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('the record-level RIN and the event-level RIN are independent slots', () => {
    const dataset = parseOk551([HEAD551, '0 @I1@ INDI', '1 RIN 111', '1 BIRT', '2 RIN 222', '0 TRLR', ''].join('\n'));
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.automatedRecordId).toBe('111');
    expect(indi.events?.[0]?.detail?.automatedRecordId).toBe('222');
  });

  test('parses in 7.0 and drops on the 7.0 export', () => {
    const dataset = parseOk70(
      [...H70, '0 @I1@ INDI', '1 NAME X /Y/', '1 BIRT', '2 RIN 789654123', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.automatedRecordId).toBe('789654123');
    const serialized = ser70(dataset);
    expect(serialized).not.toContain('RIN');
  });
});

describe('_FIL under INDI (Heredis)', () => {
  test('types the filiation and round-trips in 5.5.1', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 SEX M', '1 _FIL LEGITIMATE_CHILD', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.filiation).toBe('LEGITIMATE_CHILD');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _FIL LEGITIMATE_CHILD');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('keeps every observed value verbatim', () => {
    for (const value of ['LEGITIMATE_CHILD', 'NATURAL_CHILD', 'ADOPTED_CHILD', 'RELATIONSHIP_UNKNOW']) {
      const dataset = parseOk551([HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', `1 _FIL ${value}`, '0 TRLR', ''].join('\n'));
      const indi = dataset.records.find((r) => r.tag === 'INDI');
      if (indi?.tag !== 'INDI') {
        throw new Error('expected INDI');
      }
      expect(indi.filiation).toBe(value);
    }
  });

  test('parses and round-trips in 7.0 too', () => {
    const dataset = parseOk70(
      [...H70, '0 @I1@ INDI', '1 NAME X /Y/', '1 _FIL LEGITIMATE_CHILD', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.filiation).toBe('LEGITIMATE_CHILD');
    const serialized = ser70(dataset);
    expect(serialized).toContain('1 _FIL LEGITIMATE_CHILD');
    expect(parseOk70(serialized)).toEqual(dataset);
  });
});

describe('pointer with a trailing C-style comment', () => {
  test('parses the pointer and drops the comment silently', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 FAMC @F4@ /* note: this ptr is not required but is allowed in 5.5 */',
        '0 @F4@ FAM',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.childFamilies?.[0]?.family).toBe('@F4@');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 FAMC @F4@');
    expect(serialized).not.toContain('/*');
  });

  test('a list of pointers and a stray @ stay text', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 NOTE @a@, @b@ and @c', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.notes?.[0]).toMatchObject({ payload: '@a@, @b@ and @c' });
  });
});

describe('_UST under FAM (Heredis union status)', () => {
  test('types the value and round-trips in both versions', () => {
    const dataset = parseOk551([HEAD551, '0 @F1@ FAM', '1 _UST MARRIED', '0 TRLR', ''].join('\n'));
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam.unionStatus).toBe('MARRIED');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _UST MARRIED');
    expect(parseOk551(serialized)).toEqual(dataset);
    const dataset70 = parseOk70([...H70, '0 @F1@ FAM', '1 _UST COMMON_LAW', '0 TRLR', ''].join('\n'));
    const fam70 = dataset70.records.find((r) => r.tag === 'FAM');
    if (fam70?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam70.unionStatus).toBe('COMMON_LAW');
    const serialized70 = ser70(dataset70);
    expect(serialized70).toContain('1 _UST COMMON_LAW');
    expect(parseOk70(serialized70)).toEqual(dataset70);
  });
});

describe('WWW under HEAD.SOUR', () => {
  test('types the product web address and round-trips', () => {
    const dataset = parseOk551(
      [
        '0 HEAD',
        '1 SOUR Family Echo',
        '2 WWW http://www.familyecho.com/',
        '1 SUBM @S1@',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    expect(dataset.header.source?.www).toBe('http://www.familyecho.com/');
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 WWW http://www.familyecho.com/');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('REFN and WWW under a source citation', () => {
  test('type into the citation and round-trip in 5.5.1', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 SOUR @S0@',
        '2 REFN blah blah',
        '2 WWW https://example.org/x',
        '0 @S0@ SOUR',
        '1 TITL S',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.citations?.[0]?.referenceNumber).toBe('blah blah');
    expect(indi.citations?.[0]?.www).toBe('https://example.org/x');
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 REFN blah blah');
    expect(serialized).toContain('2 WWW https://example.org/x');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('WWW under the citation DATA types into the data slot', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 SOUR @S0@',
        '2 DATA',
        '3 WWW https://gw.geneanet.org/khreussner',
        '0 @S0@ SOUR',
        '1 TITL S',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.citations?.[0]?.data?.www).toBe('https://gw.geneanet.org/khreussner');
    const serialized = ser551(dataset);
    expect(serialized).toContain('3 WWW https://gw.geneanet.org/khreussner');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the _CROP block under a media link', () => {
  test('parses the underscore spellings into the crop slot', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 OBJE @M1@',
        '2 _CROP',
        '3 _LEFT 0',
        '3 _TOP 51',
        '3 _WDTH 186',
        '3 _HGHT 186',
        '0 @M1@ OBJE',
        '1 FILE',
        '2 FORM jpg',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.media?.[0]?.crop).toMatchObject({ left: 0, top: 51, width: 186, height: 186 });
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 _CROP');
    expect(serialized).toContain('3 _LEFT 0');
    expect(serialized).toContain('3 _TOP 51');
    expect(serialized).toContain('3 _WDTH 186');
    expect(serialized).toContain('3 _HGHT 186');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('writes the standard CROP block on the 7.0 export', () => {
    const dataset = parseOk70(
      [
        ...H70,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 OBJE @M1@',
        '2 _CROP',
        '3 _LEFT 0',
        '3 _TOP 51',
        '3 _WDTH 186',
        '3 _HGHT 186',
        '0 @M1@ OBJE',
        '1 FILE',
        '2 FORM image/jpeg',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const serialized = ser70(dataset);
    expect(serialized).toContain('2 CROP');
    expect(serialized).toContain('3 LEFT 0');
    expect(serialized).toContain('3 TOP 51');
    expect(serialized).toContain('3 WIDTH 186');
    expect(serialized).toContain('3 HEIGHT 186');
  });
});

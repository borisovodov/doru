// Typing coverage for the third corpus round: the Ancestry.com Family
// Trees media-record block (_OID/_USER/_ENCR/_ORIG/_ATL/_META/_CLON
// under OBJE) and the RIN repeated under events. Each case parses,
// round-trips model-stably and writes the canonical spelling.

import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset, MultimediaRecord } from '../src/structures';

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
    expect(rec.metadata).toBe('<metadataxml><acountry></acountry><branch></branch><cemetery></cemetery>n></metadataxml>');
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
    const rec = obje([HEAD551, '0 @O1@ OBJE', '1 FILE', '2 FORM jpg', '1 _MSER', '2 _LKID abc', '2 _BOGUS x', '0 TRLR', ''].join('\n'));
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
    const serialized = ser551(parseOk551([HEAD551, '0 @O1@ OBJE', '1 FILE', '2 FORM jpg', '1 _ATL N', '0 TRLR', ''].join('\n')));
    expect(serialized).not.toContain('_ATL');
  });

  test('_ENCR 0 clears the flag; a bare _ENCR marks it', () => {
    const cleared = obje([HEAD551, '0 @O1@ OBJE', '1 FILE', '2 FORM jpg', '1 _USER abc', '2 _ENCR 0', '0 TRLR', ''].join('\n'));
    expect(cleared.userEncrypted).toBe(false);
    const bare = obje([HEAD551, '0 @O1@ OBJE', '1 FILE', '2 FORM jpg', '1 _USER abc', '2 _ENCR', '0 TRLR', ''].join('\n'));
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
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 BIRT', '2 DATE 7 JUL 1930', '2 RIN 789654123', '1 DEAT', '2 RIN 789654123', '0 TRLR', ''].join('\n'),
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
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 RIN 111', '1 BIRT', '2 RIN 222', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.automatedRecordId).toBe('111');
    expect(indi.events?.[0]?.detail?.automatedRecordId).toBe('222');
  });

  test('parses in 7.0 and drops on the 7.0 export', () => {
    const dataset = parseOk70([...H70, '0 @I1@ INDI', '1 NAME X /Y/', '1 BIRT', '2 RIN 789654123', '0 TRLR', ''].join('\n'));
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
    const dataset = parseOk551([HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 SEX M', '1 _FIL LEGITIMATE_CHILD', '0 TRLR', ''].join('\n'));
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
    const dataset = parseOk70([...H70, '0 @I1@ INDI', '1 NAME X /Y/', '1 _FIL LEGITIMATE_CHILD', '0 TRLR', ''].join('\n'));
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
    const dataset = parseOk551([HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 NOTE @a@, @b@ and @c', '0 TRLR', ''].join('\n'));
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
      ['0 HEAD', '1 SOUR Family Echo', '2 WWW http://www.familyecho.com/', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '0 @S1@ SUBM', '1 NAME T', '0 TRLR', ''].join('\n'),
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
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 SOUR @S0@', '2 REFN blah blah', '2 WWW https://example.org/x', '0 @S0@ SOUR', '1 TITL S', '0 TRLR', ''].join('\n'),
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
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 SOUR @S0@', '2 DATA', '3 WWW https://gw.geneanet.org/khreussner', '0 @S0@ SOUR', '1 TITL S', '0 TRLR', ''].join('\n'),
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
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 OBJE @M1@', '2 _CROP', '3 _LEFT 0', '3 _TOP 51', '3 _WDTH 186', '3 _HGHT 186', '0 @M1@ OBJE', '1 FILE', '2 FORM jpg', '0 TRLR', ''].join('\n'),
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
      [...H70, '0 @I1@ INDI', '1 NAME X /Y/', '1 OBJE @M1@', '2 _CROP', '3 _LEFT 0', '3 _TOP 51', '3 _WDTH 186', '3 _HGHT 186', '0 @M1@ OBJE', '1 FILE', '2 FORM image/jpeg', '0 TRLR', ''].join('\n'),
    );
    const serialized = ser70(dataset);
    expect(serialized).toContain('2 CROP');
    expect(serialized).toContain('3 LEFT 0');
    expect(serialized).toContain('3 TOP 51');
    expect(serialized).toContain('3 WIDTH 186');
    expect(serialized).toContain('3 HEIGHT 186');
  });
});

describe('the MyHeritage _MTTAG/_MTCAT tree-tag records', () => {
  const TREE_TAGS = [
    HEAD551,
    '0 @I1@ INDI',
    '1 NAME X /Y/',
    '1 _MTTAG @T10@',
    '0 @T10@ _MTTAG',
    '1 NAME DNA Match',
    '1 RIN 10',
    '1 _VISI 1',
    '1 _MTCAT @C2@',
    '0 @C2@ _MTCAT',
    '1 NAME DNA',
    '1 RIN 2',
    '0 TRLR',
    '',
  ].join('\n');

  test('types the records and the INDI links; round-trips 5.5.1', () => {
    const dataset = parseOk551(TREE_TAGS);
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.treeTags).toEqual(['@T10@']);
    const tag = dataset.records.find((r) => r.tag === '_MTTAG');
    expect(tag).toMatchObject({
      tag: '_MTTAG',
      xref: '@T10@',
      name: 'DNA Match',
      automatedRecordId: '10',
      visible: true,
      category: '@C2@',
    });
    const cat = dataset.records.find((r) => r.tag === '_MTCAT');
    expect(cat).toMatchObject({ tag: '_MTCAT', name: 'DNA', automatedRecordId: '2' });
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _MTTAG @T10@');
    expect(serialized).toContain('0 @T10@ _MTTAG');
    expect(serialized).toContain('1 _VISI 1');
    expect(serialized).toContain('1 _MTCAT @C2@');
    expect(serialized).toContain('0 @C2@ _MTCAT');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_VISI 0 and unknown children are kept', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '0 @T10@ _MTTAG', '1 NAME DNA Match', '1 _VISI 0', '1 _BOGUS x', '0 TRLR', ''].join('\n'),
    );
    const tag = dataset.records.find((r) => r.tag === '_MTTAG');
    if (tag?.tag !== '_MTTAG') {
      throw new Error('expected _MTTAG');
    }
    expect(tag.visible).toBe(false);
    expect(tag.extensions?.some((ext) => ext.tag === '_BOGUS')).toBe(true);
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _VISI 0');
  });
});

describe('QUAY directly under an event', () => {
  test('types the event reliability and round-trips in 5.5.1; drops on 7.0', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 BIRT', '2 QUAY 2', '1 DEAT', '2 QUAY 3', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.quality).toBe('2');
    expect(indi.events?.[1]?.detail?.quality).toBe('3');
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 QUAY 2');
    expect(parseOk551(serialized)).toEqual(dataset);
    const dataset70 = parseOk70([...H70, '0 @I1@ INDI', '1 NAME X /Y/', '1 BIRT', '2 QUAY 2', '0 TRLR', ''].join('\n'));
    const serialized70 = ser70(dataset70);
    expect(serialized70).not.toContain('QUAY');
  });
});

describe('_PREF under FAM, MARR and the partner/child links', () => {
  test('types the FAM-level preferred family', () => {
    const dataset = parseOk551([HEAD551, '0 @F1@ FAM', '1 _PREF Y', '0 TRLR', ''].join('\n'));
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam.preferred).toBe(true);
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _PREF Y');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('types the MARR-level preferred marriage', () => {
    const dataset = parseOk551([HEAD551, '0 @F1@ FAM', '1 MARR', '2 _PREF Y', '2 DATE 1 JAN 1900', '0 TRLR', ''].join('\n'));
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam.events?.[0]?.preferred).toBe(true);
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 _PREF Y');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('_WPID/_HPID and _FOOT under a citation', () => {
  test('type into the citation and round-trip', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @F1@ FAM',
        '1 MARR',
        '2 SOUR @S0@',
        '3 _HPID 1,61370::465131',
        '3 _WPID 1,61370::900465131',
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 SOUR @S0@',
        '2 _FOOT Guy Allen Sims. 25 APR 2001',
        '0 @S0@ SOUR',
        '1 TITL S',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam.events?.[0]?.detail?.detail?.citations?.[0]?.husbandPersonId).toBe('1,61370::465131');
    expect(fam.events?.[0]?.detail?.detail?.citations?.[0]?.wifePersonId).toBe('1,61370::900465131');
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.citations?.[0]?.footnote).toBe('Guy Allen Sims. 25 APR 2001');
    const serialized = ser551(dataset);
    expect(serialized).toContain('3 _HPID 1,61370::465131');
    expect(serialized).toContain('3 _WPID 1,61370::900465131');
    expect(serialized).toContain('2 _FOOT Guy Allen Sims. 25 APR 2001');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('the free-text SOUR form types PAGE and the same citation slots', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 SOUR England Genealogies',
        '2 PAGE 167',
        '2 REFN ref-1',
        '2 WWW https://example.org/e',
        '2 _FOOT A footnote.',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.citations?.[0]?.page?.payload).toBe('167');
    expect(indi.citations?.[0]?.referenceNumber).toBe('ref-1');
    expect(indi.citations?.[0]?.www).toBe('https://example.org/e');
    expect(indi.citations?.[0]?.footnote).toBe('A footnote.');
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 PAGE 167');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('REF under a citation normalizes into the www slot', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 SOUR @S0@', '2 REF http://search.findmypast.com/record?id=GBC/190', '0 @S0@ SOUR', '1 TITL S', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.citations?.[0]?.www).toBe('http://search.findmypast.com/record?id=GBC/190');
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 WWW http://search.findmypast.com/record?id=GBC/190');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('_APID under SOUR and INDI records', () => {
  test('types the record-level Ancestry references and round-trips', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 _APID 1,7602::12345', '0 @S1@ SOUR', '1 TITL S', '1 _APID 1,2442::0', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.ancestryPointers).toEqual(['1,7602::12345']);
    const sour = dataset.records.find((r) => r.tag === 'SOUR');
    if (sour?.tag !== 'SOUR') {
      throw new Error('expected SOUR');
    }
    expect(sour.ancestryPointers).toEqual(['1,2442::0']);
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _APID 1,7602::12345');
    expect(serialized).toContain('1 _APID 1,2442::0');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('SOUR under FONE/ROMN and the inline OBJE link', () => {
  test('types the 5.5.1 NAME_PHONETIC_VARIATION citations and round-trips', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME Joseph Tag /Torture/',
        '2 FONE Joseph Tag /Torture/',
        '3 TYPE user defined',
        '3 SOUR @S1@',
        '4 PAGE 55',
        '4 QUAY 2',
        '2 ROMN Joseph Tag /Torture/',
        '3 TYPE user defined',
        '3 SOUR @S1@',
        '4 PAGE 56',
        '0 @S1@ SOUR',
        '1 TITL S',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.names?.[0]?.phonetic?.[0]?.citations?.[0]?.page?.payload).toBe('55');
    expect(indi.names?.[0]?.phonetic?.[0]?.citations?.[0]?.quality).toBe('2');
    expect(indi.names?.[0]?.romanized?.[0]?.citations?.[0]?.page?.payload).toBe('56');
    const serialized = ser551(dataset);
    expect(serialized).toContain('3 SOUR @S1@');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('types the citation under the 5.5.1 inline OBJE link', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 OBJE',
        '2 FILE',
        '3 FORM jpg',
        '2 SOUR @S55@',
        '3 PAGE Seniors, pp. 172-173',
        '0 @S55@ SOUR',
        '1 TITL S',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    // The inline OBJE synthesizes a multimedia record; its citation
    // carries the PAGE.
    const mediaRecord = dataset.records.find((r) => r.tag === 'OBJE');
    if (mediaRecord?.tag !== 'OBJE') {
      throw new Error('expected OBJE');
    }
    expect(mediaRecord.citations?.[0]?.page?.payload).toBe('Seniors, pp. 172-173');
    const serialized = ser551(dataset);
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the Swarm family-tree pack block (_FTSID, _PLINK under FAMC)', () => {
  test('types the ids and the profile links and round-trips', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 _FTSID 0bfd9174-d010-5b23-b0f2-a98854d921e3',
        '1 NAME Zofia /Sklodowska/',
        '1 FAMC @F1@',
        '2 PEDI birth',
        '2 _PLINK @I2@',
        '3 _FTSID 4f5b3162-d212-5d21-af6c-4defaad66d9e',
        '3 PEDI birth',
        '3 SOUR @S3@',
        '4 PAGE Marie Curie - Biographical',
        '4 QUAY 3',
        '0 @I2@ INDI',
        '1 NAME X /Y/',
        '0 @F1@ FAM',
        '0 @S3@ SOUR',
        '1 TITL S',
        '1 _FTSID abc-def',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI' && r.xref === '@I1@');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.familyTreeSystemId).toBe('0bfd9174-d010-5b23-b0f2-a98854d921e3');
    expect(indi.childFamilies?.[0]?.profileLinks?.[0]).toMatchObject({
      tag: '_PLINK',
      individual: '@I2@',
      familyTreeId: '4f5b3162-d212-5d21-af6c-4defaad66d9e',
    });
    expect(indi.childFamilies?.[0]?.profileLinks?.[0]?.pedigree?.payload).toBe('BIRTH');
    expect(indi.childFamilies?.[0]?.profileLinks?.[0]?.citations?.[0]?.page?.payload).toBe('Marie Curie - Biographical');
    const sour = dataset.records.find((r) => r.tag === 'SOUR');
    if (sour?.tag !== 'SOUR') {
      throw new Error('expected SOUR');
    }
    expect(sour.familyTreeSystemId).toBe('abc-def');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _FTSID 0bfd9174-d010-5b23-b0f2-a98854d921e3');
    expect(serialized).toContain('2 _PLINK @I2@');
    expect(serialized).toContain('3 _FTSID 4f5b3162-d212-5d21-af6c-4defaad66d9e');
    expect(serialized).toContain('3 PEDI birth');
    expect(serialized).toContain('1 _FTSID abc-def');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the working-remainder sweep (TIME, _PRIM, QUOT, ADDR, _GCID, _WEBTAG)', () => {
  test('the event-level TIME attaches to the DATE; a 12-hour value converts; junk stays generic', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 BIRT', '2 DATE 1 JAN 1900', '2 TIME 10:30', '1 DEAT', '2 DATE 2 JAN 2000', '2 TIME 2:00pm', '1 BURI', '2 TIME banana', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.date?.time).toEqual({ hour: 10, minute: 30 });
    // The 12-hour `2:00pm` converts to the 24-hour clock.
    expect(indi.events?.[1]?.detail?.date?.time).toEqual({ hour: 14, minute: 0 });
    // `banana` is not a time: the line stays a generic extension of
    // the detail (nothing is dropped at parse; the non-underscore TIME
    // extension is dropped on export — the extension rule).
    expect(indi.events?.[2]?.detail?.extensions).toContainEqual(expect.objectContaining({ tag: 'TIME', payload: 'banana' }));
    const serialized = ser551(dataset);
    expect(serialized).toContain('3 TIME 10:30');
    expect(serialized).toContain('3 TIME 14:0');
    expect(serialized).not.toContain('banana');
  });

  test('_PRIM types into the event primary slot and the name primary slot', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '2 _PRIM Y', '1 BIRT', '2 _PRIM Y', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.names?.[0]?.primary).toBe(true);
    expect(indi.events?.[0]?.detail?.primary).toBe(true);
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 _PRIM Y');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('QUOT types into FACT + TYPE Quotation under INDI and FAM', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 QUOT "To be or not to be."', '0 @F1@ FAM', '1 QUOT "A family that quotes."', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.attributes?.[0]).toMatchObject({ tag: 'FACT', payload: '"To be or not to be."', type: 'Quotation' });
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam.notes?.[0]).toMatchObject({ tag: 'NOTE', payload: '"A family that quotes."' });
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 TYPE Quotation');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('the INDI-level ADDR types with its _NAME label', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 ADDR Main St', '2 _NAME Stephen Michael Mencik', '2 CITY Town', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.address?.payload).toBe('Main St');
    expect(indi.address?.name).toBe('Stephen Michael Mencik');
    expect(indi.address?.city).toBe('Town');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 ADDR Main St');
    expect(serialized).toContain('2 _NAME Stephen Michael Mencik');
    expect(parseOk551(serialized)).toEqual(dataset);
    // 7.0 has no INDI address position: dropped.
    const dataset70 = parseOk70([...H70, '0 @I1@ INDI', '1 NAME X /Y/', '1 ADDR Main St', '0 TRLR', ''].join('\n'));
    expect(ser70(dataset70)).not.toContain('ADDR');
  });

  test('_GCID types into the record id on INDI and FAM', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 _GCID 04A344DF-82DE-4D17-97C9-067C3C21276D', '0 @F1@ FAM', '1 _GCID 3C0DEB23-6184-486F-A01C-EB698D03285B', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (indi?.tag !== 'INDI' || fam?.tag !== 'FAM') {
      throw new Error('expected records');
    }
    expect(indi.geditcomId).toBe('04A344DF-82DE-4D17-97C9-067C3C21276D');
    expect(fam.geditcomId).toBe('3C0DEB23-6184-486F-A01C-EB698D03285B');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _GCID 04A344DF-82DE-4D17-97C9-067C3C21276D');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_WEBTAG under a SOUR record types into the webTags slot', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @S1@ SOUR', '1 TITL S', '1 _WEBTAG', '2 NAME Source home', '2 URL https://example.org/s', '0 TRLR', ''].join('\n'),
    );
    const sour = dataset.records.find((r) => r.tag === 'SOUR');
    if (sour?.tag !== 'SOUR') {
      throw new Error('expected SOUR');
    }
    expect(sour.webTags?.[0]).toMatchObject({ name: 'Source home', url: 'https://example.org/s' });
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _WEBTAG');
    expect(serialized).toContain('2 NAME Source home');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('QUOT under CHIL/ASSO and _GCID on other records', () => {
  test('QUOT under a child link and an association types into notes', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @F1@ FAM',
        '1 CHIL @I2@',
        '2 QUOT "Three sons."',
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 ASSO @I3@',
        '2 RELA godfather',
        '2 QUOT "Once more to Nogaret."',
        '0 @I2@ INDI',
        '1 NAME A /B/',
        '0 @I3@ INDI',
        '1 NAME C /D/',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam.children?.[0]?.notes?.[0]).toMatchObject({ tag: 'NOTE', payload: '"Three sons."' });
    const indi = dataset.records.find((r) => r.tag === 'INDI' && r.xref === '@I1@');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.associations?.[0]?.notes?.[0]).toMatchObject({ tag: 'NOTE', payload: '"Once more to Nogaret."' });
    const serialized = ser551(dataset);
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_GCID types on NOTE and SUBM records too', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @N1@ NOTE text', '1 _GCID AAA', '0 @S2@ SUBM', '1 NAME U', '1 _GCID BBB', '0 TRLR', ''].join('\n'),
    );
    const note = dataset.records.find((r) => r.tag === 'NOTE');
    const subm = dataset.records.find((r) => r.tag === 'SUBM' && r.xref === '@S2@');
    if (note?.tag !== 'NOTE' || subm?.tag !== 'SUBM') {
      throw new Error('expected records');
    }
    expect(note.geditcomId).toBe('AAA');
    expect(subm.geditcomId).toBe('BBB');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _GCID AAA');
    expect(serialized).toContain('1 _GCID BBB');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('CHAN and CREA under an event', () => {
  test('the event-level change date types with its TIME', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 DEAT', '2 CHAN', '3 DATE 21 DEC 2007', '4 TIME 01:35', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.changeDate?.date?.time).toEqual({ hour: 1, minute: 35 });
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 CHAN');
    expect(serialized).toContain('4 TIME 1:35');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('the event-level CREA types into the creation date', () => {
    const dataset = parseOk70([...H70, '0 @I1@ INDI', '1 NAME X /Y/', '1 BIRT', '2 CREA', '3 DATE 1 JAN 2020', '4 TIME 10:00:00', '0 TRLR', ''].join('\n'));
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.creationDate).toBeDefined();
    const serialized = ser70(dataset);
    expect(serialized).toContain('2 CREA');
    expect(parseOk70(serialized)).toEqual(dataset);
  });
});

describe('the media flags, _PID under PLAC, RIN under citations and _MIDN', () => {
  test('the MyHeritage media flags and AUTH type under the inline OBJE link', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 OBJE',
        '2 FILE',
        '3 FORM jpg',
        '2 _CUTOUT Y',
        '2 _PRIM_CUTOUT Y',
        '2 _PARENTPHOTO Y',
        '2 _PERSONALPHOTO Y',
        '2 _PARENTRIN MH:P500006',
        '2 AUTH John Smith',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const obje = dataset.records.find((r) => r.tag === 'OBJE');
    if (obje?.tag !== 'OBJE') {
      throw new Error('expected OBJE');
    }
    expect(obje.cutout).toBe(true);
    expect(obje.primaryCutout).toBe(true);
    expect(obje.parentPhoto).toBe(true);
    expect(obje.personalPhoto).toBe(true);
    expect(obje.parentRecordId).toBe('MH:P500006');
    expect(obje.author).toBe('John Smith');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _CUTOUT Y');
    expect(serialized).toContain('1 _PRIM_CUTOUT Y');
    expect(serialized).toContain('1 _PARENTRIN MH:P500006');
    expect(serialized).toContain('1 AUTH John Smith');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_PID under PLAC types into the place id', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 BIRT', '2 PLAC Kielce, Poland', '3 _PID curie-joliot-place-q102317', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.place?.placeId).toBe('curie-joliot-place-q102317');
    const serialized = ser551(dataset);
    expect(serialized).toContain('3 _PID curie-joliot-place-q102317');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('RIN under a citation types and round-trips in 5.5.1', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 BIRT', '2 SOUR @S0@', '3 RIN MH:SC500011', '0 @S0@ SOUR', '1 TITL S', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.citations?.[0]?.automatedRecordId).toBe('MH:SC500011');
    const serialized = ser551(dataset);
    expect(serialized).toContain('3 RIN MH:SC500011');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_MIDN under NAME types into the middle name', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME Henry Newton /Gresham/', '2 _MIDN Newton', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.names?.[0]?.middleName).toBe('Newton');
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 _MIDN Newton');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the header mid-stream, _TYPE under _CROP and _FNA under events', () => {
  test('a NOTE before the HEAD no longer orphans the header', () => {
    const dataset = parseOk551(
      ['0 NOTE A preamble note', '0 HEAD', '1 SOUR Family Echo', '2 WWW http://www.familyecho.com/', '1 SUBM @S1@', '1 DATE 12 SEP 2022', '2 TIME 16:12:23', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '0 @S1@ SUBM', '1 NAME T', '0 @I1@ INDI', '1 NAME X /Y/', '0 TRLR', ''].join('\n'),
    );
    expect(dataset.header.source?.payload).toBe('Family Echo');
    expect(dataset.header.source?.www).toBe('http://www.familyecho.com/');
    expect(dataset.header.date?.value).toBeDefined();
    expect(dataset.header.gedcom.version).toBe('5.5.1');
    expect(dataset.records[0]?.tag).toBe('NOTE');
    const serialized = ser551(dataset);
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_TYPE under the crop block types into the crop variant', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 OBJE @M1@', '2 _CROP', '3 _LEFT 0', '3 _TOP 51', '3 _WDTH 186', '3 _HGHT 186', '3 _TYPE primary', '0 @M1@ OBJE', '1 FILE', '2 FORM jpg', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.media?.[0]?.crop?.type).toBe('primary');
    const serialized = ser551(dataset);
    expect(serialized).toContain('3 _TYPE primary');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_FNA under an event types into the Heredis flag', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 BIRT', '2 _FNA YES', '1 DEAT', '2 _FNA NO', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.fna).toBe(true);
    expect(indi.events?.[1]?.detail?.fna).toBe(false);
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 _FNA Y');
    expect(serialized).toContain('2 _FNA N');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the MFT _CRE blocks, FAM SLGC and APPT', () => {
  test('the structured _CRE under NAME/FAM/OBJE types into the creation date', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '2 _CRE',
        '3 DATE 1 JAN 2020',
        '4 TIME 10:00',
        '0 @F1@ FAM',
        '1 _CRE',
        '2 DATE 2 JAN 2021',
        '0 @M1@ OBJE',
        '1 FILE',
        '2 FORM jpg',
        '1 _CRE',
        '2 DATE 3 JAN 2022',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    const obje = dataset.records.find((r) => r.tag === 'OBJE');
    if (indi?.tag !== 'INDI' || fam?.tag !== 'FAM' || obje?.tag !== 'OBJE') {
      throw new Error('expected records');
    }
    expect(indi.names?.[0]?.creationDate?.date?.time).toEqual({ hour: 10, minute: 0 });
    expect(fam.creationDate?.date?.value).toBeDefined();
    expect(obje.creationDate?.date?.value).toBeDefined();
    const serialized = ser551(dataset);
    // 5.5.1 writes the _CRE spelling.
    expect(serialized).toContain('2 _CRE');
    expect(serialized).toContain('1 _CRE');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('SLGC under a FAM record types into the child sealing', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @F1@ FAM', '1 SLGC', '2 DATE 1 JAN 1900', '2 TEMP SLAKE', '0 TRLR', ''].join('\n'),
    );
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam.childSealings?.[0]?.tag).toBe('SLGC');
    expect(fam.childSealings?.[0]?.detail?.date).toBeDefined();
    expect(fam.childSealings?.[0]?.detail?.temple).toBe('SLAKE');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 SLGC');
    expect(serialized).toContain('2 TEMP SLAKE');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('APPT under INDI normalizes into EVEN + TYPE Application', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 APPT', '2 DATE 27 Aug 2019', '2 PLAC Supplemental - MullinsP', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]).toMatchObject({ tag: 'EVEN', type: 'Application' });
    expect(indi.events?.[0]?.detail?.date).toBeDefined();
    expect(indi.events?.[0]?.detail?.place?.payload).toEqual(['Supplemental - MullinsP']);
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 EVEN');
    expect(serialized).toContain('2 TYPE Application');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

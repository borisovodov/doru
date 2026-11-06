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

describe('the data clusters of the remainder sweep', () => {
  test('RELATION/ISDEAD/_PHOTO/_WLNK/PHON under records type', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 ISDEAD Y',
        '1 PHON 336-874-7241',
        '1 _PHOTO @M1@',
        '1 _WLNK',
        '2 TITL Birth records, search Kolovec',
        '2 NOTE http://www.portafontium.eu/searching',
        '0 @F1@ FAM',
        '1 RELATION Marriage',
        '0 @M1@ OBJE',
        '1 FILE',
        '2 FORM jpg',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (indi?.tag !== 'INDI' || fam?.tag !== 'FAM') {
      throw new Error('expected records');
    }
    expect(indi.deceased).toBe(true);
    expect(indi.phone).toEqual(['336-874-7241']);
    expect(indi.media?.[0]?.object).toBe('@M1@');
    expect(indi.webLinks?.[0]).toMatchObject({ tag: '_WLNK', title: 'Birth records, search Kolovec', url: 'http://www.portafontium.eu/searching' });
    expect(fam.unionStatus).toBe('Marriage');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 ISDEAD Y');
    expect(serialized).toContain('1 PHON 336-874-7241');
    expect(serialized).toContain('1 _WLNK');
    expect(serialized).toContain('2 NOTE http://www.portafontium.eu/searching');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_XREF under PLAC and _PATN under NAME type', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '2 _PATN Ivanovich',
        '1 BIRT',
        '2 PLAC Vicarage Rd, Camberwell',
        '3 _XREF @P14@',
        '0 @P14@ PLAC',
        '1 NAME Camberwell',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.names?.[0]?.patronymic).toBe('Ivanovich');
    expect(indi.events?.[0]?.detail?.place?.placeCard).toBe('@P14@');
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 _PATN Ivanovich');
    expect(serialized).toContain('3 _XREF @P14@');
    // The generic `0 @P14@ PLAC` card is dropped on export (the
    // non-underscore extension-record rule), so no full-equality
    // round-trip here; the typed fields survive.
    const reparsed = parseOk551(serialized);
    const indi2 = reparsed.records.find((r) => r.tag === 'INDI');
    expect(indi2?.events?.[0]?.detail?.place?.placeCard).toBe('@P14@');
  });

  test('_COR under an event types into the event map', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 BIRT',
        '2 _COR',
        '3 _LAD 41',
        '3 _LAM 38',
        '3 _LAS 26',
        '3 _LAN N',
        '3 _LOD 4',
        '3 _LOM 51',
        '3 _LOS 24',
        '3 _LON E',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.map?.latitude.direction).toBe('N');
    expect(indi.events?.[0]?.detail?.map?.longitude.direction).toBe('E');
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 MAP');
    expect(serialized).toContain('3 LATI N41.64055555555556');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('the error leniencies: TYPE other, QUAY 4, SEX long, bare SOUR, pointer text', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 SEX Male',
        '1 BIRT',
        '2 QUAY 4',
        '2 SOUR',
        '3 PAGE NSW Registry of Births',
        '0 @M1@ OBJE',
        '1 FILE',
        '2 FORM jpg',
        '3 TYPE image',
        '2 TITL @R5@',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    const obje = dataset.records.find((r) => r.tag === 'OBJE');
    if (indi?.tag !== 'INDI' || obje?.tag !== 'OBJE') {
      throw new Error('expected records');
    }
    expect(indi.sex).toBe('M');
    expect(indi.events?.[0]?.detail?.quality).toBe('4');
    // The bare SOUR is kept as an empty description with its PAGE.
    expect(indi.events?.[0]?.detail?.citations?.[0]?.description).toBe('');
    expect(indi.events?.[0]?.detail?.citations?.[0]?.page?.payload).toBe('NSW Registry of Births');
    // TYPE image becomes OTHER + phrase.
    expect(obje.files?.[0]?.form?.medium?.payload).toBe('OTHER');
    expect(obje.files?.[0]?.form?.medium?.phrase).toBe('image');
    // TITL with a pointer keeps the pointer string.
    expect(obje.files?.[0]?.title).toBe('@R5@');
    const serialized = ser551(dataset);
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('_TEXT under FILE and _COR under the place card', () => {
  test('_TEXT under the FILE line types into the file text', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @M3@ OBJE', '1 FILE C:\\FTM\\US_Presidents_20', '2 FORM bmp', '2 _TEXT Year: 1880; Census Place: District 14', '0 TRLR', ''].join('\n'),
    );
    const obje = dataset.records.find((r) => r.tag === 'OBJE');
    if (obje?.tag !== 'OBJE') {
      throw new Error('expected OBJE');
    }
    expect(obje.files?.[0]?.text).toBe('Year: 1880; Census Place: District 14');
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 _TEXT Year: 1880; Census Place: District 14');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_COR under a _PLAC card types into the card map', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @P1@ _PLAC Somewhere', '1 _COR', '2 _LAD 41', '2 _LAM 38', '2 _LAS 26', '2 _LAN N', '2 _LOD 4', '2 _LOM 51', '2 _LOS 24', '2 _LON E', '0 TRLR', ''].join('\n'),
    );
    const plc = dataset.records.find((r) => r.tag === '_PLAC');
    if (plc?.tag !== '_PLAC') {
      throw new Error('expected _PLAC');
    }
    expect(plc.map?.latitude.direction).toBe('N');
    expect(plc.map?.longitude.direction).toBe('E');
    // The 5.5.1 projection flattens the card into the referencing
    // PLAC payloads; an unreferenced card is dropped entirely.
    const serialized = ser551(dataset);
    expect(serialized).not.toContain('@P1@');
  });
});

describe('the GenoPro entity records', () => {
  test('types the entity records and the INDI containers; round-trips', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 OCCUPATIONS @occu1@',
        '1 CONTACTS @contact1@',
        '1 EDUCATIONS @edu1@',
        '1 UNIONS @marr1@',
        '1 TWINS @twin1@',
        '0 @occu1@ Occupation',
        '1 COMPANY Otizez',
        '1 INDUSTRY Construction',
        '1 PLAC Belo Horizonte',
        '2 _XREF @p1@',
        '1 DATESTART 2001',
        '1 NOTE Owner',
        '0 @edu1@ Education',
        '1 INSTITUTION Smeltings',
        '1 PLAC Smeltings',
        '0 @contact1@ Contact',
        '1 PLAC Seaford, Sussex, UK',
        '0 @marr1@ Marriage',
        '1 TYPE Civil',
        '1 DATE 2010',
        '0 @twin1@ Twin',
        '1 TWINLINK Fraternal',
        '1 FAMILY @f1@',
        '0 @f1@ FAM',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.occupations).toEqual(['@occu1@']);
    expect(indi.contacts).toEqual(['@contact1@']);
    expect(indi.educations).toEqual(['@edu1@']);
    expect(indi.marriages).toEqual(['@marr1@']);
    expect(indi.twins).toEqual(['@twin1@']);
    const occu = dataset.records.find((r) => r.tag === 'Occupation');
    if (occu?.tag !== 'Occupation') {
      throw new Error('expected Occupation');
    }
    expect(occu.company).toBe('Otizez');
    expect(occu.industry).toBe('Construction');
    expect(occu.place?.placeCard).toBe('@p1@');
    expect(occu.dateStart?.value).toBeDefined();
    expect(occu.notes?.[0]?.payload).toBe('Owner');
    const marr = dataset.records.find((r) => r.tag === 'Marriage');
    if (marr?.tag !== 'Marriage') {
      throw new Error('expected Marriage');
    }
    expect(marr.type).toBe('Civil');
    expect(marr.date?.value).toBeDefined();
    const twin = dataset.records.find((r) => r.tag === 'Twin');
    if (twin?.tag !== 'Twin') {
      throw new Error('expected Twin');
    }
    expect(twin.kind).toBe('Fraternal');
    expect(twin.family).toBe('@f1@');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 OCCUPATIONS @occu1@');
    expect(serialized).toContain('0 @occu1@ Occupation');
    expect(serialized).toContain('1 COMPANY Otizez');
    expect(serialized).toContain('1 DATESTART 2001');
    expect(serialized).toContain('1 TWINLINK Fraternal');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the corpus-remainder typings (round 6)', () => {
  test('ADDR.NOTE types into AddressStructure.notes and round-trips', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @R1@ REPO',
        '1 NAME Muriel and Richard Brine',
        '1 ADDR',
        '2 NOTE x',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const repo = dataset.records.find((r) => r.tag === 'REPO');
    if (repo?.tag !== 'REPO') {
      throw new Error('expected REPO');
    }
    expect(repo.address?.notes?.[0]?.payload).toBe('x');
    const text = ser551(dataset);
    expect(text).toContain('1 ADDR');
    expect(text).toContain('2 NOTE x');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('CHAN.SOUR types into ChangeDate.citations and round-trips', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 CHAN',
        '2 DATE 13 NOV 2003',
        '2 SOUR @S1@',
        '3 DATA',
        '4 TEXT Date of Import: 27 Jun 2005',
        '0 @S1@ SOUR',
        '1 TITL Import',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.changeDate?.citations?.[0].source).toBe('@S1@');
    expect(indi.changeDate?.citations?.[0].data?.texts?.[0]?.payload).toBe('Date of Import: 27 Jun 2005');
    const text = ser551(dataset);
    expect(text).toContain('2 SOUR @S1@');
    expect(text).toContain('4 TEXT Date of Import: 27 Jun 2005');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('TMG citations under DATE and PLAC type and round-trip', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 DEAT',
        '2 DATE 1794',
        '3 SOUR @S307@',
        '2 PLAC Waikiki',
        '3 SOUR @S308@',
        '0 @S307@ SOUR',
        '1 TITL S307',
        '0 @S308@ SOUR',
        '1 TITL S308',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const detail = indi.events?.[0]?.detail;
    expect(detail?.date?.citations?.[0].source).toBe('@S307@');
    expect(detail?.place?.citations?.[0].source).toBe('@S308@');
    const text = ser551(dataset);
    expect(text).toContain('2 DATE 1794');
    expect(text).toContain('3 SOUR @S307@');
    expect(text).toContain('2 PLAC Waikiki');
    expect(text).toContain('3 SOUR @S308@');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('NAME ALIA (with SOUR) and TITL type and round-trip', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME /Kalanimoku/',
        '2 ALIA William/Pitt/',
        '3 SOUR @S111@',
        '2 TITL King',
        '0 @S111@ SOUR',
        '1 TITL S111',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.names?.[0].aliasLinks?.[0]).toEqual({ tag: 'ALIA', value: 'William/Pitt/', citations: [{ tag: 'SOUR', source: '@S111@' }] });
    expect(indi.names?.[0].title).toBe('King');
    const text = ser551(dataset);
    expect(text).toContain('2 ALIA William/Pitt/');
    expect(text).toContain('3 SOUR @S111@');
    expect(text).toContain('2 TITL King');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('NOTE DATE/PLAC type and round-trip', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 NOTE A note',
        '2 DATE 1736',
        '2 PLAC Kealakekua',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const note = indi.notes?.[0];
    expect(note && 'payload' in note ? note.payload : undefined).toBe('A note');
    expect(note && 'date' in note && note.date !== undefined).toBe(true);
    expect(ser551(dataset)).toContain('2 DATE 1736');
    expect(ser551(dataset)).toContain('2 PLAC Kealakekua');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });

  test('the SOUR-record DATE/PLAC and the Ancestris TITL-pointer shape type and round-trip', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @S1@ SOUR',
        '1 TITL 1910 Census',
        '1 DATE 1910',
        '1 PLAC Illinois',
        '0 @S2@ SOUR',
        '1 TITL @R5@',
        '0 @R5@ TITL "The Kennedys of Massachusetts," NEHGR',
        '1 CHAN',
        '2 DATE 10 MAR 1988',
        '1 AUTH @I2@',
        '1 PUBL (Boston, MA: NEHGS)',
        '1 SERS CXXXIX, July 1985',
        '1 ABBR "Kennedys," NEHGR',
        '1 REPO @R1@',
        '0 @I2@ INDI',
        '1 NAME Edward L. /Galvin/',
        '0 @R1@ REPO',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const s1 = dataset.records.find((r) => r.tag === 'SOUR' && r.xref === '@S1@');
    if (s1?.tag !== 'SOUR') {
      throw new Error('expected SOUR @S1@');
    }
    expect(s1.title).toBe('1910 Census');
    expect(s1.date?.value).toBeDefined();
    expect(s1.place?.payload).toEqual(['Illinois']);
    const s2 = dataset.records.find((r) => r.tag === 'SOUR' && r.xref === '@S2@');
    if (s2?.tag !== 'SOUR') {
      throw new Error('expected SOUR @S2@');
    }
    expect(s2.titlRef).toBe('@R5@');
    const title = dataset.records.find((r) => r.tag === 'TITL');
    if (title?.tag !== 'TITL') {
      throw new Error('expected TITL record');
    }
    expect(title.payload).toBe('"The Kennedys of Massachusetts," NEHGR');
    expect(title.changeDate?.date).toBeDefined();
    expect(title.author).toBe('@I2@');
    expect(title.publisher).toBe('(Boston, MA: NEHGS)');
    expect(title.series).toBe('CXXXIX, July 1985');
    expect(title.abbreviation).toBe('"Kennedys," NEHGR');
    expect(title.repository).toBe('@R1@');
    const text = ser551(dataset);
    expect(text).toContain('1 DATE 1910');
    expect(text).toContain('1 PLAC Illinois');
    expect(text).toContain('1 TITL @R5@');
    expect(text).toContain('0 @R5@ TITL "The Kennedys of Massachusetts," NEHGR');
    expect(text).toContain('1 AUTH @I2@');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('PLAC under the inline OBJE link types and round-trips', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME Thomas /Gresham/',
        '1 OBJE',
        '2 FORM jpg',
        '2 FILE https://www.WikiTree.com/wiki/Image:Gresham-6.jpg',
        '2 TITL Marriage record Lauderdale Co AL.',
        '2 PLAC AL.',
        '2 DATE 1850',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const media = indi.media?.[0];
    expect(media && 'object' in media ? media.object : undefined).toBeDefined();
    const record = dataset.records.find((r) => r.tag === 'OBJE');
    if (record?.tag !== 'OBJE') {
      throw new Error('expected OBJE record');
    }
    expect(record.place).toBe('AL.');
    const text = ser551(dataset);
    expect(text).toContain('_PLAC AL.');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('the Case006 long event spellings type into EVEN + TYPE', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 BAPTISM',
        '2 DATE 1 JAN 1900',
        '2 PLAC Boston',
        '1 BAR_MITZVAH',
        '2 DATE 1905',
        '1 RESIDENCE Boston',
        '2 DATE 1910',
        '1 _MILITARY_SERVICE',
        '2 DATE 1942',
        '1 _DEGREE Ph.D.',
        '1 ENLIST',
        '2 DATE 1941',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const events = indi.events ?? [];
    expect(events.map((e) => [e.tag, e.type])).toContainEqual(['EVEN', 'Baptism']);
    expect(events.map((e) => [e.tag, e.type])).toContainEqual(['EVEN', 'Bar Mitzvah']);
    expect(events.map((e) => [e.tag, e.type])).toContainEqual(['EVEN', 'Residence']);
    expect(events.map((e) => [e.tag, e.type])).toContainEqual(['EVEN', 'Military service']);
    expect(events.map((e) => [e.tag, e.type])).toContainEqual(['EVEN', 'Enlistment']);
    const baptism = events.find((e) => e.type === 'Baptism');
    expect(baptism?.detail?.date?.value).toBeDefined();
    expect(baptism?.detail?.place?.payload).toEqual(['Boston']);
    expect(indi.attributes?.map((a) => [a.tag, a.type])).toContainEqual(['EDUC', 'Degree']);
    const text = ser551(dataset);
    expect(text).toContain('1 EVEN');
    expect(text).toContain('2 TYPE Baptism');
    expect(text).toContain('2 TYPE Bar Mitzvah');
    expect(text).toContain('2 TYPE Military service');
    expect(parseOk551(text)).toEqual(dataset);
  });
});

describe('the corpus-remainder typings (round 7)', () => {
  test('HEAD.SUBM.NAME (Family Echo) types and round-trips', () => {
    const dataset = parseOk551(
      [
        '0 HEAD',
        '1 SOUR X',
        '1 SUBM @S1@',
        '2 NAME rclark3@stevens.edu',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 @I1@ INDI',
        '1 NAME Ryan /Clark/',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    expect(dataset.header.submitter).toBe('@S1@');
    expect(dataset.header.submitterName).toBe('rclark3@stevens.edu');
    const text = ser551(dataset);
    expect(text).toContain('1 SUBM @S1@');
    // The 5.5.1 writer doubles the at sign of the literal address.
    expect(text).toContain('2 NAME rclark3@@stevens.edu');
    expect(parseOk551(text)).toEqual(dataset);
  });
});

describe('the corpus-remainder typings (round 8)', () => {
  test('a text payload in the INDI ALIA pointer slot becomes a NAME with the AKA type', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME Robert /Burnett/',
        '1 ALIA /Becky/',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.names?.[1]).toEqual({
      tag: 'NAME',
      payload: { surname: 'Becky' },
      type: { payload: 'AKA' },
    });
    const text = ser551(dataset);
    expect(text).toContain('1 NAME /Becky/');
    expect(text).toContain('2 TYPE aka');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('a pointer with a trailing // comment parses as the pointer', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @F1@ FAM',
        '1 WIFE @I9@  // Assuming Unknown_spouse record',
        '0 @I9@ INDI',
        '1 NAME X /Y/',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam.wife?.partner).toBe('@I9@');
    const text = ser551(dataset);
    expect(text).toContain('1 WIFE @I9@');
    expect(text).not.toContain('Assuming');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('a comma-separated pointer list in the GenoPro containers splits and resolves', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 OCCUPATIONS @occu1@, @occu2@',
        '1 CONTACTS @c1@',
        '0 @occu1@ Occupation',
        '1 COMPANY X',
        '0 @occu2@ Occupation',
        '1 COMPANY Y',
        '0 @c1@ Contact',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.occupations).toEqual(['@occu1@', '@occu2@']);
    expect(indi.contacts).toEqual(['@c1@']);
    const text = ser551(dataset);
    expect(text).toContain('1 OCCUPATIONS @occu1@');
    expect(text).toContain('1 OCCUPATIONS @occu2@');
    expect(parseOk551(text)).toEqual(dataset);
  });
});

describe('the corpus-remainder typings (round 9)', () => {
  test('_PGVU under CHAN types as the change user (the phpGedView spelling)', () => {
    // The UoEMainLibrary archiveslib PhpGedView 3.3.8 export (euf1.ged):
    // `1 CHAN` + `2 DATE …` + `2 _PGVU admin` on every record.
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 CHAN',
        '2 DATE 1 JAN 2005',
        '2 _PGVU admin',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.changeDate?.user).toBe('admin');
    // Written back in the canonical _WT_USER spelling of the same slot.
    const text = ser551(dataset);
    expect(text).toContain('2 _WT_USER admin');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('QUAY under the SOUR record types as its certainty assessment', () => {
    // Heredis writes the whole-source assessment at record level (the
    // alainamand / Dudouyt exports; webtrees registry, Heredis.php).
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @S9@ SOUR',
        '1 TITL t',
        '1 QUAY 2',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const sour = dataset.records.find((r) => r.tag === 'SOUR');
    if (sour?.tag !== 'SOUR') {
      throw new Error('expected SOUR');
    }
    expect(sour.certainty).toBe('2');
    const text = ser551(dataset);
    expect(text).toContain('1 QUAY 2');
    expect(parseOk551(text)).toEqual(dataset);
    // 7.0 drops the record-level QUAY (no valid 7.0 position).
    expect(ser70(dataset)).not.toContain('QUAY');
  });

  test('_UPD under the SOUR record types as its update timestamp', () => {
    // The MyHeritage `*:_UPD` position (webtrees registry,
    // MyHeritage.php; the ChatGPT-GEDCOM-processed MyHeritage exports
    // carry it on every SOUR record).
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @S9@ SOUR',
        '1 TITL t',
        '1 _UPD 4 JUN 2024 08:12:27 GMT -0500',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const sour = dataset.records.find((r) => r.tag === 'SOUR');
    if (sour?.tag !== 'SOUR') {
      throw new Error('expected SOUR');
    }
    expect(sour.updatedAt).toBe('4 JUN 2024 08:12:27 GMT -0500');
    const text = ser551(dataset);
    expect(text).toContain('1 _UPD 4 JUN 2024 08:12:27 GMT -0500');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('_UID under HEAD types as the dataset uid', () => {
    // The Family Historian / MyHeritage header uid (the Sample-GEDCOM
    // and fh-sample fixtures; webtrees registry, MyHeritage.php).
    const dataset = parseOk551(
      [
        '0 HEAD',
        '1 SOUR X',
        '1 SUBM @S1@',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '1 _UID {13F463F0-5340-4056-AB3F-49972FE733CB}',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    expect(dataset.header.uid).toBe('{13F463F0-5340-4056-AB3F-49972FE733CB}');
    const text = ser551(dataset);
    expect(text).toContain('1 _UID {13F463F0-5340-4056-AB3F-49972FE733CB}');
  });

  test('_PLACE under the OBJE record types as its place', () => {
    // Family Tree Builder spelling (webtrees registry,
    // FamilyTreeBuilder.php, OBJE:_PLACE).
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @M1@ OBJE',
        '1 FILE a.jpg',
        '2 FORM jpg',
        '1 _PLACE Rotterdam',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const obje = dataset.records.find((r) => r.tag === 'OBJE') as MultimediaRecord;
    expect(obje.place).toBe('Rotterdam');
    const text = ser551(dataset);
    expect(text).toContain('_PLAC Rotterdam');
  });

  test('_LOCL under the INDI _TODO structure types as its location', () => {
    // Legacy research-task location (webtrees registry, Legacy.php,
    // INDI:_TODO:_LOCL; the gedcom4j legacycustomtags sample).
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 _TODO',
        '2 DESC Obtain',
        '2 _CAT Birth Certificate',
        '2 _LOCL Somewhere over the rainbow',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.todos?.[0]?.locality).toBe('Somewhere over the rainbow');
    const text = ser551(dataset);
    expect(text).toContain('2 _LOCL Somewhere over the rainbow');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('the MyHeritage media flags type on the pointer-form link', () => {
    // The GEDKeeper samples write the flags under `1 OBJE @O3@`.
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 OBJE @M1@',
        '2 _PRIM Y',
        '2 _CUTOUT Y',
        '2 _PRIM_CUTOUT Y',
        '2 _PARENTPHOTO Y',
        '2 _PERSONALPHOTO Y',
        '2 _PARENTRIN MH:P500006',
        '0 @M1@ OBJE',
        '1 FILE a.jpg',
        '2 FORM jpg',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const link = indi.media?.[0];
    expect(link?.primary).toBe(true);
    expect(link?.cutout).toBe(true);
    expect(link?.primaryCutout).toBe(true);
    expect(link?.parentPhoto).toBe(true);
    expect(link?.personalPhoto).toBe(true);
    expect(link?.parentRecordId).toBe('MH:P500006');
    const text = ser551(dataset);
    expect(text).toContain('2 _PRIM_CUTOUT Y');
    expect(text).toContain('2 _PARENTRIN MH:P500006');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('PEDI under FAM.CHIL types; 7.0 projects an agreeing value onto FAMC', () => {
    // The MacFamilyTree single spelling and the swedish-royal
    // per-parent spelling with `_PARENT`.
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @F1@ FAM',
        '1 HUSB @I3@',
        '1 CHIL @I5@',
        '2 PEDI birth',
        '0 @F2@ FAM',
        '1 HUSB @I3@',
        '1 CHIL @I6@',
        '2 PEDI BIRTH',
        '3 _PARENT @I3@',
        '2 PEDI ADOPTED',
        '3 _PARENT @I4@',
        '0 @I5@ INDI',
        '1 NAME C /D/',
        '1 FAMC @F1@',
        '0 @I6@ INDI',
        '1 NAME E /F/',
        '1 FAMC @F2@',
        '0 @I3@ INDI',
        '1 NAME G /H/',
        '0 @I4@ INDI',
        '1 NAME I /J/',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const fam1 = dataset.records.find((r) => r.tag === 'FAM' && r.xref === '@F1@');
    if (fam1?.tag !== 'FAM') {
      throw new Error('expected @F1@ FAM');
    }
    expect(fam1.children?.[0]?.pedigrees?.[0]?.pedigree.payload).toBe('BIRTH');
    const fam2 = dataset.records.find((r) => r.tag === 'FAM' && r.xref === '@F2@');
    if (fam2?.tag !== 'FAM') {
      throw new Error('expected @F2@ FAM');
    }
    expect(fam2.children?.[0]?.pedigrees?.map((entry) => [entry.pedigree.payload, entry.parent])).toEqual([
      ['BIRTH', '@I3@'],
      ['ADOPTED', '@I4@'],
    ]);
    // 5.5.1 writes the CHIL-position lines back.
    const text = ser551(dataset);
    expect(text).toContain('2 PEDI BIRTH');
    expect(text).toContain('3 _PARENT @I3@');
    expect(parseOk551(text)).toEqual(dataset);
    // 7.0: the single agreeing value lands on the child's FAMC link;
    // the non-agreeing per-parent pair is dropped.
    const text70 = ser70(dataset);
    const i5 = text70.split('0 @I5@ INDI')[1]?.split('0 @')[0] ?? '';
    expect(i5).toContain('2 PEDI BIRTH');
    const i6 = text70.split('0 @I6@ INDI')[1]?.split('0 @')[0] ?? '';
    expect(i6).not.toContain('PEDI');
  });

  test('_ELEC under INDI types as the Elected fact', () => {
    // FTM custom fact (webtrees registry, FamilyTreeMaker.php).
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 _ELEC Mayor of Springfield',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const fact = indi.attributes?.find((a) => 'type' in a && a.type === 'Elected');
    expect(fact !== undefined).toBe(true);
    expect(fact && 'payload' in fact ? fact.payload : undefined).toBe('Mayor of Springfield');
  });

  test('the 5.5.1 embedded FORM/BLOB shape types and round-trips', () => {
    // The official TGC551 torture shape: the GEDCOM 5.5/5.5.1
    // MULTIMEDIA_RECORD with the record-level FORM and the BLOB block.
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 OBJE @M1@',
        '0 @M1@ OBJE',
        '1 TITL Dummy Multimedia Object',
        '1 FORM PICT',
        '1 BLOB',
        '2 CONT .HM.......k.1..F.jwA.Dzzzzw',
        '2 CONT A....1.........0U.66..E.8',
        '1 NOTE Here are some notes on this multimedia object.',
        '1 RIN 1',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const obje = dataset.records.find((r) => r.tag === 'OBJE') as MultimediaRecord;
    expect(obje.embeddedForm).toBe('PICT');
    expect(obje.embeddedBlob).toBe('.HM.......k.1..F.jwA.Dzzzzw\nA....1.........0U.66..E.8');
    expect(obje.title).toBe('Dummy Multimedia Object');
    // The 5.5.1 export spells the embedded shape back and re-parses
    // into the identical model.
    const text = ser551(dataset);
    expect(text).toContain('1 FORM PICT');
    expect(text).toContain('1 BLOB');
    expect(text).toContain('2 CONT .HM.......k.1..F.jwA.Dzzzzw');
    expect(parseOk551(text)).toEqual(dataset);
    // 7.0 has no embedded shape: the record and the link to it are
    // dropped by the projection.
    const text70 = ser70(dataset);
    expect(text70).not.toContain('@M1@ OBJE');
    expect(text70).not.toContain('1 OBJE @M1@');
  });

  test('an inline OBJE with FORM and BLOB but no FILE keeps the embedded content', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 OBJE',
        '2 FORM bmp',
        '2 BLOB',
        '3 CONT AAAB',
        '3 CONT AAAC',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    // The inline shape synthesizes a media record on export; the
    // embedded content survives on the link's synthesized record.
    const text = ser551(dataset);
    expect(text).toContain('1 FORM bmp');
    expect(text).toContain('2 CONT AAAB');
    expect(parseOk551(text)).toEqual(dataset);
    expect(indi.media !== undefined).toBe(true);
  });
});

describe('the glamberson documented extensions (round 10)', () => {
  test('the v1 evidence shapes: _EVID records, links, _RDOC and _RACT', () => {
    // The gedcom-evidence examples/basic-evidence.ged shape
    // (specification.md v1).
    const dataset = parseOk70(
      [
        '0 HEAD', '1 GEDC', '2 VERS 7.0',
        '0 @S1@ SOUR', '1 TITL 1850 Census',
        '0 @E1@ _EVID',
        '1 _TYPE Person',
        '1 _ID John Smith',
        '1 _ID aged 40',
        '1 SOUR @S1@',
        '2 PAGE Page 247, Line 12',
        '0 @I1@ INDI',
        '1 NAME John /Smith/',
        '1 _EVID @E1@',
        '2 _CONF 5',
        '2 NOTE Census record matches known facts',
        '0 @R1@ _RDOC',
        '1 _TITL Analysis',
        '1 _TEXT The ages match.',
        '1 _EVID @E1@',
        '1 _CONC',
        '2 _SUBJ @I1@',
        '2 _TEXT Definitely identified',
        '1 AUTH Jane Researcher',
        '0 @A1@ _RACT',
        '1 _TYPE Search',
        '1 _RSLT NotFound',
        '1 DATE 20 JAN 2025',
        '1 _FIND No birth record',
        '2 _EVID @E1@',
        '0 TRLR', '',
      ].join('\n'),
    );
    const evid = dataset.records.find((r) => r.tag === '_EVID');
    if (evid?.tag !== '_EVID') {
      throw new Error('expected _EVID');
    }
    expect(evid.type).toBe('Person');
    expect(evid.identifiers).toEqual(['John Smith', 'aged 40']);
    expect(evid.citations?.[0]?.page?.payload).toBe('Page 247, Line 12');
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    // The v1 `_EVID` link normalizes into the `_EVREF` slot.
    expect(indi.evidence?.[0]?.tag).toBe('_EVREF');
    expect(indi.evidence?.[0]?.evidence).toBe('@E1@');
    expect(indi.evidence?.[0]?.confidence).toBe('5');
    const rdoc = dataset.records.find((r) => r.tag === '_RDOC');
    if (rdoc?.tag !== '_RDOC') {
      throw new Error('expected _RDOC');
    }
    expect(rdoc.title).toBe('Analysis');
    expect(rdoc.conclusions?.[0]).toEqual({ tag: '_CONC', subject: '@I1@', text: 'Definitely identified' });
    const ract = dataset.records.find((r) => r.tag === '_RACT');
    if (ract?.tag !== '_RACT') {
      throw new Error('expected _RACT');
    }
    expect(ract.result).toBe('NotFound');
    expect(ract.findings?.[0]?.evidence).toEqual(['@E1@']);
    // Both versions write the constructs back; the link as `_EVREF`.
    for (const ser of [ser551(dataset), ser70(dataset)]) {
      expect(ser).toContain('0 @E1@ _EVID');
      expect(ser).toContain('1 _EVREF @E1@');
      expect(ser).toContain('2 _CONF 5');
      expect(ser).toContain('0 @R1@ _RDOC');
      expect(ser).toContain('0 @A1@ _RACT');
    }
    expect(parseOk70(ser70(dataset))).toEqual(dataset);
    const out551 = ser551(dataset);
    expect(ser551(parseOk551(out551))).toBe(out551);
  });

  test('the v2 evidence shapes: _EVREF, _EVEN_EVID, _FIND, _DTYPE', () => {
    // The registry YAML shapes (record-EVID.yaml, _EVREF.yaml,
    // _EVEN_EVID.yaml, _FIND.yaml) of the pattern1/pattern2 examples.
    const dataset = parseOk70(
      [
        '0 HEAD', '1 GEDC', '2 VERS 7.0',
        '0 @S1@ SOUR', '1 TITL t',
        '0 @E1@ _EVID',
        '1 _DTYPE Census',
        '1 DATE 7 JUN 1850',
        '1 SOUR @S1@',
        '1 _FIND John Smith, age 42, farmer',
        '2 TYPE Personal Information',
        '2 AGE 42y',
        '0 @I1@ INDI',
        '1 NAME John /Smith/',
        '1 _EVREF @E1@',
        '2 _CONF High',
        '2 _USED Name and age match',
        '2 QUAY 3',
        '1 _EVEN_EVID',
        '2 TYPE Evidence Discovery',
        '2 SOUR @S1@',
        '2 _FIND born 4 May 1823',
        '3 TYPE Birth Information',
        '2 _CONF Medium',
        '0 TRLR', '',
      ].join('\n'),
    );
    const evid = dataset.records.find((r) => r.tag === '_EVID');
    if (evid?.tag !== '_EVID') {
      throw new Error('expected _EVID');
    }
    expect(evid.documentType).toBe('Census');
    expect(evid.findings?.[0]?.payload).toBe('John Smith, age 42, farmer');
    expect(evid.findings?.[0]?.type).toBe('Personal Information');
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.evidence?.[0]).toMatchObject({ tag: '_EVREF', evidence: '@E1@', confidence: 'High', used: 'Name and age match', quality: '3' });
    expect(indi.evidenceEvents?.[0]?.type).toBe('Evidence Discovery');
    expect(indi.evidenceEvents?.[0]?.findings?.[0]?.type).toBe('Birth Information');
    expect(indi.evidenceEvents?.[0]?.confidence).toBe('Medium');
    expect(parseOk70(ser70(dataset))).toEqual(dataset);
    const out551 = ser551(dataset);
    expect(ser551(parseOk551(out551))).toBe(out551);
  });

  test('the gedcom-tags records and applications round-trip', () => {
    const dataset = parseOk70(
      [
        '0 HEAD', '1 GEDC', '2 VERS 7.0',
        '0 @T1@ _TAG',
        '1 NAME DNA Match',
        '1 _COLOR #00FF00',
        '1 _ATTR priority',
        '2 _VALUE high',
        '0 @I1@ INDI',
        '1 NAME John /Smith/',
        '1 _TAG @T1@',
        '2 DATE 15 DEC 2024',
        '2 NOTE 3rd cousin match',
        '0 @N1@ NOTE A shared note',
        '1 _TAG @T1@',
        '0 TRLR', '',
      ].join('\n'),
    );
    const tag = dataset.records.find((r) => r.tag === '_TAG');
    if (tag?.tag !== '_TAG') {
      throw new Error('expected _TAG');
    }
    expect(tag.name).toBe('DNA Match');
    expect(tag.color).toBe('#00FF00');
    expect(tag.attributes?.[0]).toEqual({ tag: '_ATTR', payload: 'priority', value: 'high' });
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.tagLinks?.[0]?.target).toBe('@T1@');
    expect(indi.tagLinks?.[0]?.notes?.[0]).toMatchObject({ payload: '3rd cousin match' });
    const note = dataset.records.find((r) => r.tag === 'NOTE');
    expect(note?.tag === 'NOTE' ? note.tagLinks?.[0]?.target : undefined).toBe('@T1@');
    for (const ser of [ser551(dataset), ser70(dataset)]) {
      expect(ser).toContain('0 @T1@ _TAG');
      expect(ser).toContain('1 _COLOR #00FF00');
      expect(ser).toContain('1 _ATTR priority');
      expect(ser).toContain('2 _VALUE high');
      expect(ser).toContain('1 _TAG @T1@');
    }
    // The NOTE record projects onto SNOTE in 7.0 and keeps its tag
    // links there; both outputs are idempotent.
    const out70 = ser70(dataset);
    const reparsed70 = parseOk70(out70);
    const snote = reparsed70.records.find((r) => r.tag === 'SNOTE');
    expect(snote?.tag === 'SNOTE' ? snote.tagLinks?.[0]?.target : undefined).toBe('@T1@');
    expect(ser70(reparsed70)).toBe(out70);
    const out551 = ser551(dataset);
    expect(ser551(parseOk551(out551))).toBe(out551);
  });

  test('the extended ASSO fields type and round-trip', () => {
    // The gedcom-extended-ASSO specification.md shapes.
    const dataset = parseOk70(
      [
        '0 HEAD', '1 GEDC', '2 VERS 7.0',
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 ASSO @I2@',
        '2 ROLE Godfather',
        '2 _TYPE Godparent',
        '2 _PERIOD',
        '3 _START 15 MAY 1850',
        '3 _END 15 MAY 1868',
        '2 _CONF 4',
        '2 _PRIV Y',
        '2 NOTE Spiritual guardian',
        '0 @I2@ INDI',
        '1 NAME C /D/',
        '0 TRLR', '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI' && r.xref === '@I1@');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const asso = indi.associations?.[0];
    expect(asso?.specificType).toBe('Godparent');
    expect(asso?.period?.start?.value).toMatchObject({ day: 15, month: 'MAY', year: 1850 });
    expect(asso?.period?.end?.value).toMatchObject({ day: 15, month: 'MAY', year: 1868 });
    expect(asso?.confidence).toBe('4');
    expect(asso?.private).toBe(true);
    for (const ser of [ser551(dataset), ser70(dataset)]) {
      expect(ser).toContain('2 _TYPE Godparent');
      expect(ser).toContain('2 _PERIOD');
      expect(ser).toContain('2 _CONF 4');
      expect(ser).toContain('2 _PRIV Y');
    }
    expect(parseOk70(ser70(dataset))).toEqual(dataset);
  });

  test('the occurrence v0.2.0 grammar: _OCREF data, FAM superstructure, event position, _OCUR extras', () => {
    const dataset = parseOk70(
      [
        '0 HEAD', '1 GEDC', '2 VERS 7.0',
        '0 @O1@ _OCUR',
        '1 TYPE Census',
        '1 AGNC NARA',
        '1 _ATTR Schedule_Type',
        '2 _VALUE Population',
        '1 _PART @F1@',
        '2 ROLE Household',
        '2 SOUR @S1@',
        '0 @S1@ SOUR',
        '1 TITL t',
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 _OCREF @O1@',
        '2 ROLE Head',
        '0 @I1@ INDI',
        '1 NAME John /Smith/',
        '1 CENS',
        '2 DATE 1850',
        '2 _OCREF @O1@',
        '3 ROLE Head',
        '3 AGE 45y',
        '0 TRLR', '',
      ].join('\n'),
    );
    const ocur = dataset.records.find((r) => r.tag === '_OCUR');
    if (ocur?.tag !== '_OCUR') {
      throw new Error('expected _OCUR');
    }
    expect(ocur.agency).toBe('NARA');
    expect(ocur.attributes?.[0]).toEqual({ tag: '_ATTR', payload: 'Schedule_Type', value: 'Population' });
    expect(ocur.participants?.[0]?.individual).toBe('@F1@');
    expect(ocur.participants?.[0]?.citations?.length).toBe(1);
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    expect(fam?.tag === 'FAM' ? fam.occurrences?.[0]?.role : undefined).toBe('Head');
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const cens = indi.events.find((e) => e.tag === 'CENS');
    expect(cens?.detail.occurrences?.[0]?.occurrence).toBe('@O1@');
    expect(cens?.detail.occurrences?.[0]?.role).toBe('Head');
    expect(parseOk70(ser70(dataset))).toEqual(dataset);
    const out551 = ser551(dataset);
    expect(ser551(parseOk551(out551))).toBe(out551);
  });

  test('the NAME-level evidence link of the gramps census example types', () => {
    const dataset = parseOk70(
      [
        '0 HEAD', '1 GEDC', '2 VERS 7.0',
        '0 @E1@ _EVID',
        '1 _ID John Smith (census)',
        '1 SOUR @S1@',
        '0 @S1@ SOUR',
        '1 TITL t',
        '0 @I1@ INDI',
        '1 NAME John /Smith/',
        '2 TYPE Birth',
        '2 _EVID @E1@',
        '3 _CONF Medium',
        '0 TRLR', '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.names?.[0]?.evidence?.[0]).toMatchObject({ tag: '_EVREF', evidence: '@E1@', confidence: 'Medium' });
    const ser = ser70(dataset);
    expect(ser).toContain('2 _EVREF @E1@');
    expect(parseOk70(ser)).toEqual(dataset);
  });
});

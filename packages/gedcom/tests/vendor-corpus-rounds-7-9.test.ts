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
      [HEAD551, '0 @I1@ INDI', '1 NAME Robert /Burnett/', '1 ALIA /Becky/', '0 TRLR', ''].join('\n'),
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
      [HEAD551, '0 @I1@ INDI', '1 NAME A /B/', '1 CHAN', '2 DATE 1 JAN 2005', '2 _PGVU admin', '0 TRLR', ''].join('\n'),
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
    const dataset = parseOk551([HEAD551, '0 @S9@ SOUR', '1 TITL t', '1 QUAY 2', '0 TRLR', ''].join('\n'));
    const sour = dataset.records.find((r) => r.tag === 'SOUR');
    if (sour?.tag !== 'SOUR') {
      throw new Error('expected SOUR');
    }
    expect(sour.certainty).toBe('2');
    // Heredis' record-level QUAY is preserved on both writers so the
    // whole-source assessment survives a round-trip.
    for (const text of [ser551(dataset), ser70(dataset)]) {
      expect(text).toContain('1 QUAY 2');
      const reparsed = text.includes('2 VERS 7.0') ? parseOk70(text) : parseOk551(text);
      const reparsedSour = reparsed.records.find((r) => r.tag === 'SOUR');
      expect(reparsedSour?.tag === 'SOUR' ? reparsedSour.certainty : 'unexpected').toBe('2');
    }
  });

  test('_UPD under the SOUR record types as its update timestamp', () => {
    // The MyHeritage `*:_UPD` position (webtrees registry,
    // MyHeritage.php; the ChatGPT-GEDCOM-processed MyHeritage exports
    // carry it on every SOUR record).
    const dataset = parseOk551(
      [HEAD551, '0 @S9@ SOUR', '1 TITL t', '1 _UPD 4 JUN 2024 08:12:27 GMT -0500', '0 TRLR', ''].join('\n'),
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
      [HEAD551, '0 @M1@ OBJE', '1 FILE a.jpg', '2 FORM jpg', '1 _PLACE Rotterdam', '0 TRLR', ''].join('\n'),
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

  test('PEDI under FAM.CHIL types; both versions project an agreeing value onto FAMC', () => {
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
    // Both versions project the single agreeing value onto the child's
    // FAMC link; the non-agreeing per-parent pair and the CHIL-position
    // `_PARENT` lines are dropped.
    for (const text of [ser551(dataset), ser70(dataset)]) {
      expect(text).not.toContain('3 _PARENT');
      const i5 = text.split('0 @I5@ INDI')[1]?.split('0 @')[0] ?? '';
      expect(i5.toLowerCase()).toContain('2 pedi birth');
      const i6 = text.split('0 @I6@ INDI')[1]?.split('0 @')[0] ?? '';
      expect(i6).not.toContain('PEDI');
    }
  });

  test('_ELEC under INDI types as the Elected fact', () => {
    // FTM custom fact (webtrees registry, FamilyTreeMaker.php).
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME A /B/', '1 _ELEC Mayor of Springfield', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const fact = indi.attributes?.find((a) => 'type' in a && a.type === 'Elected');
    expect(fact !== undefined).toBe(true);
    expect(fact && 'payload' in fact ? fact.payload : undefined).toBe('Mayor of Springfield');
  });

  test('the 5.5 embedded FORM/BLOB shape types on input and drops on export', () => {
    // The GEDCOM 5.5 MULTIMEDIA_RECORD with the record-level FORM and
    // the BLOB block. GEDCOM 5.5.1 eliminated BLOB and requires FILE
    // (the FamilySearch changelog), so neither export can spell it.
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
    for (const text of [ser551(dataset), ser70(dataset)]) {
      expect(text).not.toContain('@M1@ OBJE');
      expect(text).not.toContain('1 OBJE @M1@');
      expect(text).not.toContain('1 FORM PICT');
      expect(text).not.toContain('1 BLOB');
    }
  });

  test('an inline OBJE with FORM and BLOB but no FILE drops on export', () => {
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
    expect(indi.media !== undefined).toBe(true);
    for (const text of [ser551(dataset), ser70(dataset)]) {
      expect(text).not.toContain('1 OBJE');
      expect(text).not.toContain('1 FORM bmp');
      expect(text).not.toContain('2 CONT AAAB');
    }
  });
});

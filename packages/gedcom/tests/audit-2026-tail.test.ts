import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset, IndividualRecord } from '../src/structures';

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
  if (record === undefined) {
    throw new Error('expected INDI');
  }
  return record;
}

describe('the 2026-11 tail: Legacy marriage report fields, Aldfaer birth data, phpGedView CEME, event creation dates', () => {
  test('the Legacy FAM.MARR report labels and phrases round-trip in both versions', () => {
    const dataset = parseOk551(
      [
        ...H551,
        '0 @F1@ FAM',
        '1 MARR',
        '2 _HTITL The groom',
        '2 _WTITL The bride',
        '2 _RPT_PHRS First phrase',
        '2 _RPT_PHRS2 Second phrase',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
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
    const dataset = parseOk551(
      [...H551, '0 @I1@ INDI', '1 NAME A /B/', '1 BIRT', '2 _LENGTH 52 cm', '2 _WEIGHT 3900 g', ...SUBM, '0 TRLR'].join(
        '\n',
      ),
    );
    const birth = indi(dataset).events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.birthLength).toBe('52 cm');
    expect(birth?.detail?.birthWeight).toBe('3900 g');
    const out = lines(ser551(dataset));
    expect(out).toContain('2 _LENGTH 52 cm');
    expect(out).toContain('2 _WEIGHT 3900 g');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });

  test('the Aldfaer time under BIRT attaches to the date TIME slot', () => {
    const dataset = parseOk551(
      [
        ...H551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 BIRT',
        '2 DATE 1 JAN 1900',
        '2 _ALDFAER_TIME 10:30',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const birth = indi(dataset).events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.date?.time).toEqual({ hour: 10, minute: 30 });
    // The write-back uses the standard DATE.TIME spelling.
    const out = lines(ser551(dataset));
    expect(out).toContain('2 DATE 1 JAN 1900');
    expect(out).toContain('3 TIME 10:30');
    expect(out).not.toContain('_ALDFAER_TIME');
  });

  test('the Aldfaer time without a DATE stays a generic extension', () => {
    const dataset = parseOk551(
      [...H551, '0 @I1@ INDI', '1 NAME A /B/', '1 DEAT', '2 _ALDFAER_TIME 22:00', ...SUBM, '0 TRLR'].join('\n'),
    );
    const death = indi(dataset).events?.find((entry) => entry.tag === 'DEAT');
    expect(death?.detail?.extensions).toContainEqual(
      expect.objectContaining({ tag: '_ALDFAER_TIME', payload: '22:00' }),
    );
    expect(lines(ser551(dataset))).toContain('2 _ALDFAER_TIME 22:00');
  });

  test('the phpGedView CEME under BURI types into the cemetery slot', () => {
    const dataset = parseOk551(
      [...H551, '0 @I1@ INDI', '1 NAME A /B/', '1 BURI', '2 CEME Old Cemetery', ...SUBM, '0 TRLR'].join('\n'),
    );
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
    const dataset = parseOk551(
      [...H551, '0 @I1@ INDI', '1 NAME A /B/', '1 BIRT', '2 _CRE 12 JUN 2020', ...SUBM, '0 TRLR'].join('\n'),
    );
    const birth = indi(dataset).events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.createdAt).toBe('12 JUN 2020');
    // The canonical write-back spelling is _CREAT.
    expect(lines(ser551(dataset))).toContain('2 _CREAT 12 JUN 2020');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });
});

describe('the MyHeritage export metadata and the Généatique _THUM flag', () => {
  test('the HEAD metadata types and round-trips', () => {
    const dataset = parseOk551(
      [
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
      ].join('\n'),
    );
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
    const dataset = parseOk551(
      [
        ...H551,
        '0 _PUBLISH',
        '1 _SITEADDRESS ferreiramouraborges',
        '1 _SITENAME Ferreira Moura Borges',
        '1 _SITEID 255552541',
        '1 _USERNAME jlborges@@fe.up.pt',
        '1 _DISABLED Y',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
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
    const dataset = parseOk551(
      [
        ...H551,
        '0 @O1@ OBJE',
        '1 FILE media/pic.jpg',
        '2 FORM jpg',
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 OBJE @O1@',
        '2 _THUM Y',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const link = indi(dataset).media?.[0];
    expect(link?.thumbnail).toBe(true);
    expect(lines(ser551(dataset))).toContain('2 _THUM Y');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });
});

describe('the FTM citation _LINK and the FTB/MyHeritage media attributes', () => {
  test('_LINK under a citation types and round-trips in both versions', () => {
    const dataset = parseOk551(
      [
        ...H551,
        '0 @S2@ SOUR',
        '1 TITL Book',
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 BIRT',
        '2 SOUR @S2@',
        '3 _LINK http://gedcom4j.org',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const birth = indi(dataset).events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.citations?.[0]?.links).toEqual(['http://gedcom4j.org']);
    const out = lines(ser551(dataset));
    expect(out).toContain('3 _LINK http://gedcom4j.org');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
    expect(lines(ser70(dataset))).toContain('3 _LINK http://gedcom4j.org');
  });

  test('the FTB/MyHeritage media attributes type on the inline OBJE file', () => {
    const dataset = parseOk551(
      [
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
      ].join('\n'),
    );
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
    const dataset = parseOk551(
      [
        ...H551,
        '0 @O1@ OBJE',
        '1 FILE doc.jpg',
        '2 FORM jpg',
        '1 _FILESIZE 1024',
        '1 _ALBUM @A1@',
        '1 _PHOTO_RIN MH:P1',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
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

describe('the extension-family pointers under the NO rule and void pointers', () => {
  test('a _PART at a FAM the NO rule drops is stripped from the 5.5.1 output', () => {
    const dataset = parseOk551(
      [
        ...H551,
        '0 @F1@ FAM',
        '1 NO DIV',
        '0 @O1@ _OCUR',
        '1 TYPE Census',
        '1 _PART @F1@',
        '2 ROLE Household',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).not.toContain('@F1@');
    expect(text).not.toContain('_PART');
    expect(text).not.toContain('ROLE Household');
    expect(text).toContain('0 @O1@ _OCUR');
    expect(text).toContain('1 TYPE Census');
  });

  test('a _SUBJ at an INDI the NO rule drops is stripped; the conclusion keeps its text', () => {
    const dataset = parseOk551(
      [
        ...H551,
        '0 @I2@ INDI',
        '1 NO BIRT',
        '0 @R1@ _RDOC',
        '1 _TEXT The analysis.',
        '1 _SUBJ @I2@',
        '1 _CONC',
        '2 _SUBJ @I2@',
        '2 _TEXT Definitely identified',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).not.toContain('@I2@');
    expect(text).not.toContain('_SUBJ');
    expect(text).toContain('0 @R1@ _RDOC');
    expect(text).toContain('1 _CONC');
    expect(text).toContain('2 _TEXT Definitely identified');
  });

  test('a _PARENT at a dropped INDI is stripped; the PEDI value survives', () => {
    const dataset = parseOk551(
      [
        ...H551,
        '0 @F1@ FAM',
        '1 HUSB @I3@',
        '1 CHIL @I4@',
        '2 PEDI BIRTH',
        '3 _PARENT @I2@',
        '0 @I2@ INDI',
        '1 NO BIRT',
        '0 @I3@ INDI',
        '1 NAME F /G/',
        '0 @I4@ INDI',
        '1 NAME C /D/',
        '1 FAMC @F1@',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).not.toContain('@I2@');
    // The pedigree projects onto the standard FAMC link; the per-parent
    // `_PARENT` pointer (a non-standard CHIL-position child) is dropped.
    expect(text).toContain('2 PEDI birth');
    expect(text).not.toContain('_PARENT');
    expect(text).toContain('1 CHIL @I4@');
  });

  test('void pointers: 7.0 keeps the block, 5.5.1 drops it whole', () => {
    const dataset = parseOk70(
      [
        ...H70,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 _EVREF @VOID@',
        '2 _CONF High',
        '1 _OCREF @VOID@',
        '2 ROLE Head',
        '1 _TAG @VOID@',
        '2 NOTE kept in 7.0 only',
        '0 TRLR',
      ].join('\n'),
    );
    const text70 = ser70(dataset);
    expect(text70).toContain('1 _EVREF @VOID@');
    expect(text70).toContain('2 _CONF High');
    expect(text70).toContain('1 _OCREF @VOID@');
    expect(text70).toContain('1 _TAG @VOID@');
    expect(parseOk70(text70)).toEqual(dataset);
    // 5.5.1 has no void pointer: the blocks are dropped whole, with
    // their children (no orphaned substructure lines).
    const text551 = ser551(dataset);
    expect(text551).not.toContain('@VOID@');
    expect(text551).not.toContain('_EVREF');
    expect(text551).not.toContain('_OCREF');
    expect(text551).not.toContain('_TAG');
    expect(text551).not.toContain('_CONF');
  });

  test('an _RDOC link at an embedded OBJE dropped by the projections is stripped', () => {
    // Neither target grammar can spell the embedded shape (5.5.1
    // eliminated BLOB and requires FILE; 7.0 requires FILE): the
    // `_EVID` documents link must not dangle in either output.
    const dataset551 = parseOk551(
      [
        ...H551,
        '0 @M1@ OBJE',
        '1 TITL The picture',
        '0 @E1@ _EVID',
        '1 _TYPE Person',
        '1 _RDOC @M1@',
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 _EVID @E1@',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text551 = ser551(dataset551);
    expect(text551).not.toContain('@M1@');
    expect(text551).not.toContain('1 _RDOC');
    expect(text551).toContain('0 @E1@ _EVID');
    expect(text551).toContain('1 _EVREF @E1@');

    const datasetForm = parseOk551(
      [
        ...H551,
        '0 @M2@ OBJE',
        '1 FORM gif',
        '1 TITL The picture',
        '0 @E2@ _EVID',
        '1 _TYPE Person',
        '1 _RDOC @M2@',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    // Both versions drop the record and strip the link.
    for (const text of [ser551(datasetForm), ser70(datasetForm)]) {
      expect(text).not.toContain('@M2@');
      expect(text).not.toContain('1 _RDOC');
      expect(text).toContain('0 @E2@ _EVID');
    }
  });

  test('the SEX citations type and round-trip under the SEX structure', () => {
    // The FTM Mac willis shape: a full citation subtree under the SEX
    // fact, with the 5.5.1-style DATA/TEXT inside. Neither grammar has
    // a standard SEX substructure, but the vendor shape is written back
    // under SEX so the evidence stays attached to the sex fact.
    const dataset = parseOk551(
      [
        ...H551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 SEX M',
        '2 SOUR @S9@',
        '3 PAGE Year: 1880',
        '3 DATA',
        '4 TEXT Record for Charles Willis',
        '0 @S9@ SOUR',
        '1 TITL t',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI') as IndividualRecord;
    expect(indi.sexCitations?.[0]?.source).toBe('@S9@');
    expect(indi.sexCitations?.[0]?.page?.payload).toBe('Year: 1880');
    expect((indi as { extensions?: unknown[] }).extensions).toBeUndefined();
    for (const text of [ser551(dataset), ser70(dataset)]) {
      expect(text).toContain('1 SEX M\r\n2 SOUR @S9@');
      expect(text).toContain('3 PAGE Year: 1880');
      const reparsed = text.includes('2 VERS 7.0') ? parseOk70(text) : parseOk551(text);
      const reparsedIndi = reparsed.records.find((r) => r.tag === 'INDI') as IndividualRecord;
      expect(reparsedIndi.sexCitations?.[0]?.source).toBe('@S9@');
    }
  });
});

import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type {
  FamilyRecord,
  GedcomDataset,
  IndividualRecord,
  MultimediaRecord,
  PlaceRecord,
  SourceRecord,
} from '../src/structures';

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

const HEADER551 = ['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
const HEADER70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0'];
const SUBM = ['0 @S1@ SUBM', '1 NAME Tester'];

describe('GEDCOM 5.5EL header marker', () => {
  test('VERS 5.5.1 EL parses through the 5.5.1 pipeline', () => {
    const dataset = parseOk551(
      ['0 HEAD', '1 SOUR PC-AHNEN', '1 GEDC', '2 VERS 5.5.1 EL', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '0 @S1@ SUBM', '1 NAME T', '0 TRLR'].join('\n'),
    );
    expect(dataset.header.gedcom.version).toBe('5.5.1 EL');
  });

  test('unpublished 5.5 patch levels are still rejected', () => {
    const result = parseGedcom551(
      enc(['0 HEAD', '1 SOUR PAF', '1 GEDC', '2 VERS 5.5.9', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '0 TRLR'].join('\n')),
    );
    expect(result.ok).toBe(false);
    expect((result as { error: { code: string } }).error.code).toBe('document.wrong-version');
  });
});

describe('GEDCOM-L addendum declaration under GEDC.VERS', () => {
  const SAMPLE = ['0 HEAD', '1 SOUR PAF', '1 GEDC', '2 VERS 5.5.1', '3 _ADDENDUM', '4 VERS R2', '4 WWW https://example.com/addendum', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', ...SUBM, '0 TRLR'];

  test('parses into Gedcom.addendum', () => {
    const dataset = parseOk551(SAMPLE.join('\n'));
    expect(dataset.header.gedcom.addendum).toEqual({
      tag: '_ADDENDUM',
      version: 'R2',
      www: 'https://example.com/addendum',
    });
  });

  test('round-trips through the 5.5.1 serializer', () => {
    const text = ser551(parseOk551(SAMPLE.join('\n')));
    expect(text).toContain('3 _ADDENDUM');
    expect(text).toContain('4 VERS R2');
    expect(text).toContain('4 WWW https://example.com/addendum');
    expect(parseOk551(text).header.gedcom.addendum?.version).toBe('R2');
  });
});

describe('GEDC-level extensions round-trip', () => {
  test('_EXTENDED_LOCATIONS survives the 5.5.1 round trip', () => {
    const text = ser551(
      parseOk551(['0 HEAD', '1 SOUR PAF', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '2 _EXTENDED_LOCATIONS', '1 CHAR UTF-8', ...SUBM, '0 TRLR'].join('\n')),
    );
    expect(text).toContain('2 _EXTENDED_LOCATIONS');
  });
});

describe('NOTE payload that looks like a pointer', () => {
  test('7.0 keeps the raw text instead of emptying the payload', () => {
    const dataset = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 NOTE @FOO@\n0 TRLR\n');
    const indi = dataset.records.find((r): r is IndividualRecord => r.tag === 'INDI');
    expect(indi?.notes?.[0]?.payload).toBe('@FOO@');
    // The writer re-emits the value verbatim; it re-parses into the
    // same payload.
    expect(ser70(dataset)).toContain('1 NOTE @FOO@');
    expect(parseOk70(ser70(dataset))).toEqual(dataset);
  });
});

describe('event times under the 5.5.1 DATE', () => {
  test('Généatique-style TIME parses into DateStructure.time', () => {
    const dataset = parseOk551([...HEADER551, '0 @I1@ INDI', '1 NAME A /B/', '1 DEAT', '2 DATE 1 JAN 1900', '3 TIME 10:30', ...SUBM, '0 TRLR'].join('\n'));
    const indi = dataset.records.find((r): r is IndividualRecord => r.tag === 'INDI');
    expect(indi?.events?.find((e) => e.tag === 'DEAT')?.detail?.date?.time).toEqual({ hour: 10, minute: 30 });
  });

  test('7.0 export writes the time back under DATE', () => {
    const dataset = parseOk551([...HEADER551, '0 @I1@ INDI', '1 NAME A /B/', '1 DEAT', '2 DATE 1 JAN 1900', '3 TIME 10:30', ...SUBM, '0 TRLR'].join('\n'));
    expect(ser70(dataset)).toContain('3 TIME 10:30');
  });
});

describe('5.5.5 media formats project onto the 5.5.1 equivalents', () => {
  test('JPEG and TIFF become JPG and TIF', () => {
    const dataset = parseOk551([...HEADER551, '0 @O1@ OBJE', '1 FILE photo.jpeg', '2 FORM JPEG', ...SUBM, '0 TRLR'].join('\n'));
    const text = ser551(dataset);
    expect(text).toContain('2 FORM jpg');
    const tiff = parseOk551([...HEADER551, '0 @O1@ OBJE', '1 FILE scan.tif', '2 FORM TIFF', ...SUBM, '0 TRLR'].join('\n'));
    expect(ser551(tiff)).toContain('2 FORM tif');
  });
});

describe('GEDCOM 5.5EL _LOC details', () => {
  test('NAME.NAMC parses and round-trips', () => {
    const dataset = parseOk551([...HEADER551, '0 @P1@ _LOC', '1 NAME Hamburg', '2 NAMC Freie und Hansestadt', ...SUBM, '0 TRLR'].join('\n'));
    const place = dataset.records.find((r): r is PlaceRecord => r.tag === '_PLAC');
    expect(place?.names?.[0]?.addition).toBe('Freie und Hansestadt');
    const text = ser551(dataset);
    expect(text).toContain('2 NAMC Freie und Hansestadt');
    expect(parseOk551(text).records.find((r): r is PlaceRecord => r.tag === '_PLAC')?.names?.[0]?.addition).toBe('Freie und Hansestadt');
  });

  test('_LOC EVEN.TYPE parses into EventDetail.type and round-trips', () => {
    const dataset = parseOk551([...HEADER551, '0 @P1@ _LOC', '1 NAME Hamburg', '1 EVEN', '2 TYPE City rights', '2 DATE 1189', ...SUBM, '0 TRLR'].join('\n'));
    const place = dataset.records.find((r): r is PlaceRecord => r.tag === '_PLAC');
    expect(place?.events?.[0]?.detail?.type).toBe('City rights');
    expect(ser551(dataset)).toContain('2 TYPE City rights');
  });

  test('FAM-level ASSO parses like the GEDCOM-L _ASSO', () => {
    const dataset = parseOk551([...HEADER551, '0 @F1@ FAM', '1 HUSB @I1@', '1 WIFE @I2@', '1 ASSO @I3@', '2 RELA Priest', '0 @I1@ INDI', '0 @I2@ INDI', '0 @I3@ INDI', ...SUBM, '0 TRLR'].join('\n'));
    const fam = dataset.records.find((r): r is FamilyRecord => r.tag === 'FAM');
    expect(fam?.associations?.[0]?.individual).toBe('@I3@');
    expect(fam?.associations?.[0]?.role?.phrase).toBe('Priest');
    // 5.5.1 export spells the association `_ASSO` + RELA.
    expect(ser551(dataset)).toContain('1 _ASSO @I3@');
  });
});

describe('GEDCOM-L FAM.RESI descriptor', () => {
  test('the optional payload parses and round-trips', () => {
    const dataset = parseOk551([...HEADER551, '0 @F1@ FAM', '1 RESI Landhaus', '2 PLAC Hamburg', ...SUBM, '0 TRLR'].join('\n'));
    const fam = dataset.records.find((r): r is FamilyRecord => r.tag === 'FAM');
    expect(fam?.attributes?.[0]?.payload).toBe('Landhaus');
    expect(ser551(dataset)).toContain('1 RESI Landhaus');
  });
});

describe('vendor contact and identifier additions', () => {
  test('_EMAIL under INDI types into IndividualRecord.email', () => {
    // 5.5.1 values must double every @ (the parser enforces it).
    const dataset = parseOk551([...HEADER551, '0 @I1@ INDI', '1 _EMAIL a@@b.c', ...SUBM, '0 TRLR'].join('\n'));
    const indi = dataset.records.find((r): r is IndividualRecord => r.tag === 'INDI');
    expect(indi?.email).toEqual(['a@b.c']);
    expect(ser551(dataset)).toContain('1 _EMAIL a@@b.c');
  });

  test('PAF INDI contacts parse (EMAIL typed, ADDR/PHON/FAX verbatim)', () => {
    const dataset = parseOk551([...HEADER551, '0 @I1@ INDI', '1 ADDR Main St', '2 CITY Town', '1 PHON 123', '1 EMAIL a@@b.c', ...SUBM, '0 TRLR'].join('\n'));
    const indi = dataset.records.find((r): r is IndividualRecord => r.tag === 'INDI');
    expect(indi?.email).toEqual(['a@b.c']);
    const text = ser551(dataset);
    expect(text).toContain('1 ADDR Main St');
    expect(text).toContain('2 CITY Town');
    expect(text).toContain('1 PHON 123');
    // The typed e-mail writes back as the _EMAIL spelling.
    expect(text).toContain('1 _EMAIL a@@b.c');
  });

  test('Ancestry _INIT normalizes to INIL and back to _INIT on 5.5.1', () => {
    const dataset = parseOk551([...HEADER551, '0 @I1@ INDI', '1 _INIT Y', '2 DATE 12 JUN 1980', ...SUBM, '0 TRLR'].join('\n'));
    const indi = dataset.records.find((r): r is IndividualRecord => r.tag === 'INDI');
    expect(indi?.ordinances?.[0]?.tag).toBe('INIL');
    expect(ser551(dataset)).toContain('1 _INIT');
    expect(ser70(dataset)).toContain('1 INIL');
  });

  test('Ancestry _ORDI normalizes to the ORDN event', () => {
    const dataset = parseOk551([...HEADER551, '0 @I1@ INDI', '1 _ORDI Y', ...SUBM, '0 TRLR'].join('\n'));
    const indi = dataset.records.find((r): r is IndividualRecord => r.tag === 'INDI');
    expect(indi?.events?.[0]?.tag).toBe('ORDN');
    expect(ser551(dataset)).toContain('1 ORDN');
  });

  test('Reunion _LEGA/_PURC/_SALE normalize into slots', () => {
    const dataset = parseOk551([...HEADER551, '0 @I1@ INDI', '1 _LEGA @I2@', '1 _PURC 1 JAN 1900', '1 _SALE 1905', '0 @I2@ INDI', ...SUBM, '0 TRLR'].join('\n'));
    const indi = dataset.records.find((r): r is IndividualRecord => r.tag === 'INDI');
    expect(indi?.associations?.[0]?.role?.phrase).toBe('Legatee');
    expect(indi?.events?.map((e) => e.type)).toEqual(['Land purchase', 'Land sale']);
  });

  test('MFT8 MRCI/MRRE normalize into MARR types', () => {
    const dataset = parseOk551([...HEADER551, '0 @F1@ FAM', '1 HUSB @I1@', '1 WIFE @I2@', '1 MRCI', '0 @I1@ INDI', '0 @I2@ INDI', ...SUBM, '0 TRLR'].join('\n'));
    const fam = dataset.records.find((r): r is FamilyRecord => r.tag === 'FAM');
    expect(fam?.events?.map((e) => e.type)).toEqual(['civil']);
    expect(ser551(dataset)).toContain('2 TYPE civil');
  });

  test('Legacy FAM _TAG2–_TAG9 type into FamilyRecord.marks', () => {
    const dataset = parseOk551([...HEADER551, '0 @F1@ FAM', '1 _TAG2 One', '1 _TAG4 Three', ...SUBM, '0 TRLR'].join('\n'));
    const fam = dataset.records.find((r): r is FamilyRecord => r.tag === 'FAM');
    expect(fam?.marks).toEqual(['One', '', 'Three']);
    const text = ser551(dataset);
    expect(text).toContain('1 _TAG2 One');
    expect(text).toContain('1 _TAG4 Three');
  });
});

describe('source record additions', () => {
  test('RootsMagic record-level _SUBQ and _BIBL round-trip', () => {
    const dataset = parseOk551([...HEADER551, '0 @S2@ SOUR', '1 TITL The Title', '1 _SUBQ Short', '1 _BIBL The bibliography', ...SUBM, '0 TRLR'].join('\n'));
    const source = dataset.records.find((r): r is SourceRecord => r.tag === 'SOUR');
    expect(source?.subsequentCitationFormat).toBe('Short');
    expect(source?.bibliography).toBe('The bibliography');
    expect(ser551(dataset)).toContain('1 _SUBQ Short');
    expect(ser551(dataset)).toContain('1 _BIBL The bibliography');
  });

  test('Heredis SOUR:TYPE normalizes into sourceType', () => {
    const dataset = parseOk551([...HEADER551, '0 @S2@ SOUR', '1 TYPE Book', ...SUBM, '0 TRLR'].join('\n'));
    const source = dataset.records.find((r): r is SourceRecord => r.tag === 'SOUR');
    expect(source?.sourceType).toBe('Book');
    expect(ser551(dataset)).toContain('1 _TYPE Book');
  });

  test('extensions under AUTH/TITL/ABBR keep their nesting', () => {
    const dataset = parseOk551([...HEADER551, '0 @S2@ SOUR', '1 AUTH John Doe', '2 _FOO bar', ...SUBM, '0 TRLR'].join('\n'));
    const source = dataset.records.find((r): r is SourceRecord => r.tag === 'SOUR');
    expect(source?.authorExtensions?.[0]?.tag).toBe('_FOO');
    const text = ser551(dataset);
    expect(text).toContain('2 _FOO bar');
    expect(parseOk551(text).records.find((r): r is SourceRecord => r.tag === 'SOUR')?.authorExtensions?.[0]?.payload).toBe('bar');
  });

  test('RootsMagic _TMPLT under a citation round-trips', () => {
    const dataset = parseOk551([...HEADER551, '0 @S2@ SOUR', '1 TITL T', '0 @I1@ INDI', '1 SOUR @S2@', '2 _TMPLT', '3 FIELD', '4 NAME Page', '4 VALUE 12', ...SUBM, '0 TRLR'].join('\n'));
    const indi = dataset.records.find((r): r is IndividualRecord => r.tag === 'INDI');
    expect(indi?.citations?.[0]?.template?.fields?.[0]?.name).toBe('Page');
    const text = ser551(dataset);
    expect(text).toContain('2 _TMPLT');
    expect(parseOk551(text).records.find((r): r is IndividualRecord => r.tag === 'INDI')?.citations?.[0]?.template?.fields?.[0]?.value).toBe('12');
  });

  test('Généatique citation TEXT under the SOUR pointer normalizes into data.texts', () => {
    const dataset = parseOk551([...HEADER551, '0 @S2@ SOUR', '1 TITL T', '0 @I1@ INDI', '1 SOUR @S2@', '2 TEXT the excerpt', ...SUBM, '0 TRLR'].join('\n'));
    const indi = dataset.records.find((r): r is IndividualRecord => r.tag === 'INDI');
    expect(indi?.citations?.[0]?.data?.texts?.[0]?.payload).toBe('the excerpt');
  });
});

describe('multimedia record additions', () => {
  test('Ancestry OBJE.DATE/PLAC type into the record slots', () => {
    const dataset = parseOk551([...HEADER551, '0 @O1@ OBJE', '1 FILE p.jpg', '2 FORM jpg', '1 DATE 2000', '1 PLAC Paris', ...SUBM, '0 TRLR'].join('\n'));
    const media = dataset.records.find((r): r is MultimediaRecord => r.tag === 'OBJE');
    expect(media?.date?.value?.kind).toBe('date');
    expect(media?.place).toBe('Paris');
    expect(ser551(dataset)).toContain('1 _DATE 2000');
    expect(ser551(dataset)).toContain('1 _PLAC Paris');
  });

  test('record-level _PRIM/_SCBK/_SSHOW round-trip', () => {
    const dataset = parseOk551([...HEADER551, '0 @O1@ OBJE', '1 FILE p.jpg', '2 FORM jpg', '1 _PRIM Y', ...SUBM, '0 TRLR'].join('\n'));
    const media = dataset.records.find((r): r is MultimediaRecord => r.tag === 'OBJE');
    expect(media?.primary).toBe(true);
    expect(ser551(dataset)).toContain('1 _PRIM Y');
  });

  test('Généatique OBJE.FORM/TITL are kept verbatim', () => {
    const dataset = parseOk551([...HEADER551, '0 @O1@ OBJE', '1 FILE p.jpg', '2 FORM jpg', '1 FORM gif', '1 TITL The picture', ...SUBM, '0 TRLR'].join('\n'));
    const text = ser551(dataset);
    expect(text).toContain('1 FORM gif');
    expect(text).toContain('1 TITL The picture');
  });
});

describe('pointer-line children are no longer discarded', () => {
  test('HEAD.SUBM children are kept as header extensions', () => {
    const dataset = parseOk551(['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '2 _EMAI a@@b.c', '2 ADDR Main St', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', ...SUBM, '0 TRLR'].join('\n'));
    const text = ser551(dataset);
    expect(text).toContain('1 _EMAI a@@b.c');
  });
});

describe('parse-time extension retention', () => {
  test('generic extensions under CREA survive the round trip', () => {
    const dataset = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 CREA\n2 DATE 1 JAN 2000\n2 _FOO bar\n0 TRLR\n');
    const text = ser70(dataset);
    expect(text).toContain('2 _FOO bar');
    expect(parseOk70(text)).toEqual(dataset);
  });

  test('generic extensions under MARR.HUSB AGE survive the round trip', () => {
    const dataset = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @F1@ FAM\n1 MARR\n2 HUSB\n3 AGE 30y\n3 _FOO bar\n0 TRLR\n');
    const text = ser70(dataset);
    expect(text).toContain('3 _FOO bar');
    expect(parseOk70(text)).toEqual(dataset);
  });

  test('generic extensions under a 7.0 ordinance STAT survive the round trip', () => {
    const dataset = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 BAPL\n2 STAT COMPLETED\n3 DATE 1 JAN 2000\n3 _FOO bar\n0 TRLR\n');
    const text = ser70(dataset);
    expect(text).toContain('3 _FOO bar');
    expect(parseOk70(text)).toEqual(dataset);
  });
});

describe('SCHMA multi-URI resolution (GEDCOM 7.0 §1.5.1)', () => {
  test('record level: the declaration naming a standard record wins', () => {
    const dataset = parseOk70(
      ['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 SCHMA',
        '2 TAG _USER https://gedcom.io/terms/v7/record-SUBM',
        '2 TAG _USER http://example.com/other-meaning',
        '0 @U1@ _USER', '1 NAME Aliased record', '0 TRLR'].join('\n'),
    );
    expect(dataset.records.find((r) => r.xref === '@U1@')).toEqual({ tag: 'SUBM', xref: '@U1@', name: 'Aliased record' });
  });

  test('record level: two declarations naming record types stay generic', () => {
    const dataset = parseOk70(
      ['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 SCHMA',
        '2 TAG _X https://gedcom.io/terms/v7/record-SUBM',
        '2 TAG _X https://gedcom.io/terms/v7/record-SOUR',
        '0 @X1@ _X', '1 NAME N', '0 TRLR'].join('\n'),
    );
    const record = dataset.records.find((r) => r.xref === '@X1@');
    expect(record?.tag).toBe('_X');
  });

  test('substructure level: the declaration with a slot here wins regardless of order', () => {
    const dataset = parseOk70(
      ['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 SCHMA',
        '2 TAG _WHEN https://gedcom.io/terms/v7/DATE',
        '2 TAG _WHEN http://example.com/other-meaning',
        '0 @I1@ INDI', '1 BIRT', '2 _WHEN 1900', '0 TRLR'].join('\n'),
    );
    const birth = dataset.records.find((r): r is IndividualRecord => r.tag === 'INDI')?.events?.find((e) => e.tag === 'BIRT');
    expect(birth?.detail?.date?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', year: 1900 });
  });

  test('substructure level: two matching declarations stay generic instead of guessing', () => {
    const dataset = parseOk70(
      ['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 SCHMA',
        '2 TAG _D https://gedcom.io/terms/v7/DATE',
        '2 TAG _D https://gedcom.io/terms/v7/PLAC',
        '0 @I1@ INDI', '1 BIRT', '2 _D 1900', '0 TRLR'].join('\n'),
    );
    const indi = dataset.records.find((r): r is IndividualRecord => r.tag === 'INDI');
    expect(indi?.events?.find((e) => e.tag === 'BIRT')?.extensions?.map((e) => e.tag)).toEqual(['_D']);
  });

  test('date payloads: the calendar declaration wins regardless of order', () => {
    // The extension calendar keeps its spelling in the model; the
    // declaration is used to validate the month against the calendar it
    // abbreviates (with the old last-declaration-wins resolution the
    // non-calendar URI would have shadowed it and the month would fail).
    const dataset = parseOk70(
      ['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 SCHMA',
        '2 TAG _CALENDRIER https://gedcom.io/terms/v7/cal-FRENCH_R',
        '2 TAG _CALENDRIER http://example.com/calendar',
        '0 @I1@ INDI', '1 DEAT', '2 DATE _CALENDRIER 8 VEND 190', '0 TRLR'].join('\n'),
    );
    const death = dataset.records.find((r): r is IndividualRecord => r.tag === 'INDI')?.events?.find((e) => e.tag === 'DEAT');
    expect(death?.detail?.date?.value).toEqual({ kind: 'date', calendar: '_CALENDRIER', day: 8, month: 'VEND', year: 190 });
  });
});

describe('pointer-shaped extension payloads', () => {
  test('the payload is marked but not resolved', () => {
    const dataset = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @R1@ SOUR\n1 TITL T\n0 @I1@ INDI\n1 _EXT1 @R1@\n0 TRLR\n');
    const indi = dataset.records.find((r): r is IndividualRecord => r.tag === 'INDI');
    expect(indi?.extensions?.[0]).toEqual({ tag: '_EXT1', payload: '@R1@', payloadKind: 'pointer', children: [] });
    expect(ser70(dataset)).toContain('1 _EXT1 @R1@');
  });

  test('5.5.1 NO rule keeps a record referenced by an extension payload alive', () => {
    // The NO rule only applies to 7.0 input (NO is a 7.0 structure): a
    // 7.0 dataset with a NO BIRT is projected onto 5.5.1, where the NO
    // is dropped and the emptied record would normally go with it — the
    // extension payload pins it.
    const dataset = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 _FOO @I2@\n0 @I2@ INDI\n1 NO BIRT\n0 TRLR\n');
    const text = ser551(dataset);
    expect(text).toContain('1 _FOO @I2@');
    expect(text).toContain('0 @I2@ INDI');
    // And the output re-parses (no dangling pointer).
    expect(parseOk551(text)).toBeDefined();
  });

  test('5.5.1 keeps a place card referenced by an extension payload alive', () => {
    const dataset = parseOk551([...HEADER551, '0 @P1@ _LOC', '1 NAME Hamburg', '0 @I1@ INDI', '1 _FOO @P1@', ...SUBM, '0 TRLR'].join('\n'));
    const text = ser551(dataset);
    expect(text).toContain('0 @P1@ _LOC');
    expect(text).toContain('1 NAME Hamburg');
    expect(text).toContain('1 _FOO @P1@');
    expect(parseOk551(text)).toBeDefined();
  });
});

describe('generic extensions now emitted everywhere', () => {
  const roundtrip70 = (body: string[]): void => {
    const dataset = parseOk70(['0 HEAD', '1 GEDC', '2 VERS 7.0', ...body, '0 TRLR'].join('\n'));
    const text = ser70(dataset);
    expect(parseOk70(text)).toEqual(dataset);
  };

  test('extensions under ADDR, AGE, DATE, NOTE and PLAC round-trip', () => {
    roundtrip70(['0 @I1@ INDI', '1 BIRT', '2 DATE 1 JAN 1900', '3 _D1 x', '2 ADDR Main St', '3 _A1 x', '2 PLAC Paris', '3 _P1 x', '2 AGE 30y', '3 _AGE1 x', '2 NOTE n', '3 _N1 x']);
  });

  test('extensions under a source citation stay beneath the SOUR line', () => {
    const dataset = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @S1@ SOUR\n1 TITL T\n0 @I1@ INDI\n1 SOUR @S1@\n2 _C1 x\n0 TRLR\n');
    const text = ser70(dataset);
    expect(text).toContain('2 _C1 x');
    expect(parseOk70(text)).toEqual(dataset);
  });

  test('extensions under _LOC children (NAME/EVEN/parent) round-trip', () => {
    const dataset = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @P1@ _LOC\n1 NAME Hamburg\n2 _N1 x\n1 EVEN\n2 _E1 x\n0 TRLR\n');
    const text = ser70(dataset);
    expect(text).toContain('2 _N1 x');
    expect(parseOk70(text)).toEqual(dataset);
  });

  test('extensions under SDATE and the NO date round-trip', () => {
    roundtrip70(['0 @I1@ INDI', '1 NO MARR', '2 DATE FROM 1900 TO 1910', '3 _D1 x']);
    roundtrip70(['0 @I1@ INDI', '1 BIRT', '2 SDATE 1900', '3 _S1 x']);
  });

  test('extensions under HEAD.SOUR/CORP/DATA/PLAC round-trip', () => {
    roundtrip70([
      '1 SOUR PAF',
      '2 CORP Corp',
      '3 _C1 x',
      '2 DATA db',
      '3 _D1 x',
      '2 _S1 x',
      '1 PLAC',
      '2 FORM City',
      '2 _P1 x',
      '1 _H1 x',
      '0 @S1@ SUBM',
      '1 NAME T',
    ]);
  });

  test('extensions under MEDIA FILE/FORM and the multimedia link round-trip', () => {
    roundtrip70(['0 @O1@ OBJE', '1 FILE a.jpg', '2 FORM image/jpeg', '3 _F1 x', '2 _FILE1 x', '0 @I1@ INDI', '1 OBJE @O1@', '2 CROP', '3 _CR1 x', '2 _L1 x']);
  });

  test('extensions under CHAN and CREA round-trip', () => {
    roundtrip70(['0 @I1@ INDI', '1 CHAN', '2 DATE 1 JAN 2000', '2 _CH1 x', '1 CREA', '2 DATE 1 JAN 2000', '2 _CR1 x']);
  });

  test('extensions under the repository citation and CALN round-trip', () => {
    roundtrip70(['0 @R1@ REPO', '1 NAME R', '0 @S1@ SOUR', '1 TITL T', '1 REPO @R1@', '2 _RP1 x', '2 CALN call', '3 _CL1 x']);
  });
});

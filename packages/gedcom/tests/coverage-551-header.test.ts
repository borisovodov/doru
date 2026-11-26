import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { FamilyRecord, GedcomDataset, IndividualRecord, PlaceRecord } from '../src/structures';

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

const HEADER551 = [
  '0 HEAD',
  '1 SOUR PAF',
  '1 SUBM @S1@',
  '1 GEDC',
  '2 VERS 5.5.1',
  '2 FORM LINEAGE-LINKED',
  '1 CHAR UTF-8',
];
const SUBM = ['0 @S1@ SUBM', '1 NAME Tester'];

describe('GEDCOM 5.5EL header marker', () => {
  test('VERS 5.5.1 EL parses through the 5.5.1 pipeline', () => {
    const dataset = parseOk551(
      [
        '0 HEAD',
        '1 SOUR PC-AHNEN',
        '1 GEDC',
        '2 VERS 5.5.1 EL',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 TRLR',
      ].join('\n'),
    );
    expect(dataset.header.gedcom.version).toBe('5.5.1 EL');
  });

  test('unpublished 5.5 patch levels parse under the 5.5.1 grammar', () => {
    const dataset = parseOk551(
      ['0 HEAD', '1 SOUR PAF', '1 GEDC', '2 VERS 5.5.9', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '0 TRLR'].join('\n'),
    );
    expect(dataset.header.gedcom.version).toBe('5.5.9');
  });
});

describe('GEDCOM-L addendum declaration under GEDC.VERS', () => {
  const SAMPLE = [
    '0 HEAD',
    '1 SOUR PAF',
    '1 GEDC',
    '2 VERS 5.5.1',
    '3 _ADDENDUM',
    '4 VERS R2',
    '4 WWW https://example.com/addendum',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
    ...SUBM,
    '0 TRLR',
  ];
  const NAMED = [
    '0 HEAD',
    '1 SOUR PAF',
    '1 GEDC',
    '2 VERS 5.5.1',
    '3 _ADDENDUM GEDCOM-L Addendum',
    '4 VERS R2',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
    ...SUBM,
    '0 TRLR',
  ];

  test('parses into Gedcom.addenda', () => {
    const dataset = parseOk551(SAMPLE.join('\n'));
    expect(dataset.header.gedcom.addenda).toEqual([
      {
        tag: '_ADDENDUM',
        version: 'R2',
        www: 'https://example.com/addendum',
      },
    ]);
  });

  test('parses the addendum name payload (the spec §7.3 form)', () => {
    const dataset = parseOk551(NAMED.join('\n'));
    expect(dataset.header.gedcom.addenda).toEqual([
      {
        tag: '_ADDENDUM',
        payload: 'GEDCOM-L Addendum',
        version: 'R2',
      },
    ]);
  });

  test('accepts several addenda ({0:M})', () => {
    const text = [
      '0 HEAD',
      '1 SOUR PAF',
      '1 GEDC',
      '2 VERS 5.5.1',
      '3 _ADDENDUM GEDCOM-L Addendum',
      '3 _ADDENDUM GEDCOM-L EL Addendum',
      '2 FORM LINEAGE-LINKED',
      '1 CHAR UTF-8',
      ...SUBM,
      '0 TRLR',
    ].join('\n');
    const dataset = parseOk551(text);
    expect(dataset.header.gedcom.addenda?.map((entry) => entry.payload)).toEqual([
      'GEDCOM-L Addendum',
      'GEDCOM-L EL Addendum',
    ]);
  });

  test('round-trips through the 5.5.1 serializer', () => {
    const text = ser551(parseOk551(SAMPLE.join('\n')));
    expect(text).toContain('3 _ADDENDUM');
    expect(text).toContain('4 VERS R2');
    expect(text).toContain('4 WWW https://example.com/addendum');
    expect(parseOk551(text).header.gedcom.addenda?.[0]?.version).toBe('R2');
  });

  test('writes the name payload back', () => {
    const text = ser551(parseOk551(NAMED.join('\n')));
    expect(text).toContain('3 _ADDENDUM GEDCOM-L Addendum');
    expect(parseOk551(text).header.gedcom.addenda?.[0]?.payload).toBe('GEDCOM-L Addendum');
  });
});

describe('GEDC-level extensions round-trip', () => {
  test('_EXTENDED_LOCATIONS survives the 5.5.1 round trip', () => {
    const text = ser551(
      parseOk551(
        [
          '0 HEAD',
          '1 SOUR PAF',
          '1 GEDC',
          '2 VERS 5.5.1',
          '2 FORM LINEAGE-LINKED',
          '2 _EXTENDED_LOCATIONS',
          '1 CHAR UTF-8',
          ...SUBM,
          '0 TRLR',
        ].join('\n'),
      ),
    );
    expect(text).toContain('2 _EXTENDED_LOCATIONS');
  });
});

describe('NOTE payload that looks like a pointer', () => {
  test('7.0 keeps the raw text instead of emptying the payload', () => {
    const dataset = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 NOTE @FOO@\n0 TRLR\n');
    const indi = dataset.records.find((r): r is IndividualRecord => r.tag === 'INDI');
    const note = indi?.notes?.[0];
    expect(note !== undefined && 'payload' in note ? note.payload : undefined).toBe('@FOO@');
    // The writer doubles the leading @ (GEDCOM 7.0 §1.3: a line string
    // starting with @ must escape it) so the value re-parses as text
    // instead of a pointer.
    expect(ser70(dataset)).toContain('1 NOTE @@FOO@');
    expect(parseOk70(ser70(dataset))).toEqual(dataset);
  });
});

describe('event times under the 5.5.1 DATE', () => {
  test('Généatique-style TIME parses into DateStructure.time', () => {
    const dataset = parseOk551(
      [
        ...HEADER551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 DEAT',
        '2 DATE 1 JAN 1900',
        '3 TIME 10:30',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records.find((r): r is IndividualRecord => r.tag === 'INDI');
    expect(indi?.events?.find((e) => e.tag === 'DEAT')?.detail?.date?.time).toEqual({ hour: 10, minute: 30 });
  });

  test('7.0 export writes the time back under DATE', () => {
    const dataset = parseOk551(
      [
        ...HEADER551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 DEAT',
        '2 DATE 1 JAN 1900',
        '3 TIME 10:30',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    expect(ser70(dataset)).toContain('3 TIME 10:30');
  });
});

describe('5.5.5 media formats project onto the 5.5.1 equivalents', () => {
  test('JPEG and TIFF become JPG and TIF', () => {
    const dataset = parseOk551(
      [...HEADER551, '0 @O1@ OBJE', '1 FILE photo.jpeg', '2 FORM JPEG', ...SUBM, '0 TRLR'].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('2 FORM jpg');
    const tiff = parseOk551(
      [...HEADER551, '0 @O1@ OBJE', '1 FILE scan.tif', '2 FORM TIFF', ...SUBM, '0 TRLR'].join('\n'),
    );
    expect(ser551(tiff)).toContain('2 FORM tif');
  });
});

describe('GEDCOM 5.5EL _LOC details', () => {
  test('NAME.NAMC parses and round-trips', () => {
    const dataset = parseOk551(
      [...HEADER551, '0 @P1@ _LOC', '1 NAME Hamburg', '2 NAMC Freie und Hansestadt', ...SUBM, '0 TRLR'].join('\n'),
    );
    const place = dataset.records.find((r): r is PlaceRecord => r.tag === '_PLAC');
    expect(place?.names?.[0]?.addition).toBe('Freie und Hansestadt');
    const text = ser551(dataset);
    expect(text).toContain('2 NAMC Freie und Hansestadt');
    expect(parseOk551(text).records.find((r): r is PlaceRecord => r.tag === '_PLAC')?.names?.[0]?.addition).toBe(
      'Freie und Hansestadt',
    );
  });

  test('_LOC EVEN.TYPE parses into EventDetail.type and round-trips', () => {
    const dataset = parseOk551(
      [
        ...HEADER551,
        '0 @P1@ _LOC',
        '1 NAME Hamburg',
        '1 EVEN',
        '2 TYPE City rights',
        '2 DATE 1189',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const place = dataset.records.find((r): r is PlaceRecord => r.tag === '_PLAC');
    expect(place?.events?.[0]?.detail?.type).toBe('City rights');
    expect(ser551(dataset)).toContain('2 TYPE City rights');
  });

  test('FAM-level ASSO parses like the GEDCOM-L _ASSO', () => {
    const dataset = parseOk551(
      [
        ...HEADER551,
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 WIFE @I2@',
        '1 ASSO @I3@',
        '2 RELA Priest',
        '0 @I1@ INDI',
        '0 @I2@ INDI',
        '0 @I3@ INDI',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const fam = dataset.records.find((r): r is FamilyRecord => r.tag === 'FAM');
    expect(fam?.associations?.[0]?.individual).toBe('@I3@');
    expect(fam?.associations?.[0]?.role?.phrase).toBe('Priest');
    // 5.5.1 export spells the association `_ASSO` + RELA.
    expect(ser551(dataset)).toContain('1 _ASSO @I3@');
  });
});

describe('GEDCOM-L FAM.RESI descriptor', () => {
  test('the optional payload parses and round-trips', () => {
    const dataset = parseOk551(
      [...HEADER551, '0 @F1@ FAM', '1 RESI Landhaus', '2 PLAC Hamburg', ...SUBM, '0 TRLR'].join('\n'),
    );
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

  test('PAF INDI contacts parse (EMAIL typed, ADDR typed into the record slot)', () => {
    const dataset = parseOk551(
      [
        ...HEADER551,
        '0 @I1@ INDI',
        '1 ADDR Main St',
        '2 CITY Town',
        '1 PHON 123',
        '1 EMAIL a@@b.c',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records.find((r): r is IndividualRecord => r.tag === 'INDI');
    expect(indi?.email).toEqual(['a@b.c']);
    // The INDI-level ADDR types into IndividualRecord.address and is
    // written back as the ADDR block in 5.5.1; 7.0 has no INDI address
    // position and drops it. PHON types into the phone slot.
    const text = ser551(dataset);
    expect(text).toContain('1 ADDR Main St');
    expect(text).toContain('2 CITY Town');
    expect(text).toContain('1 PHON 123');
    // The typed e-mail stays in the address block, so it writes back as
    // the ADDRESS_STRUCTURE EMAIL spelling.
    expect(text).toContain('1 EMAIL a@@b.c');
  });

  test('Ancestry _INIT normalizes to INIL and back to _INIT on 5.5.1', () => {
    const dataset = parseOk551(
      [...HEADER551, '0 @I1@ INDI', '1 _INIT Y', '2 DATE 12 JUN 1980', ...SUBM, '0 TRLR'].join('\n'),
    );
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
    const dataset = parseOk551(
      [
        ...HEADER551,
        '0 @I1@ INDI',
        '1 _LEGA @I2@',
        '1 _PURC 1 JAN 1900',
        '1 _SALE 1905',
        '0 @I2@ INDI',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records.find((r): r is IndividualRecord => r.tag === 'INDI');
    expect(indi?.associations?.[0]?.role?.phrase).toBe('Legatee');
    expect(indi?.events?.map((e) => e.type)).toEqual(['Land purchase', 'Land sale']);
  });

  test('MFT8 MRCI/MRRE normalize into MARR types', () => {
    const dataset = parseOk551(
      [
        ...HEADER551,
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 WIFE @I2@',
        '1 MRCI',
        '0 @I1@ INDI',
        '0 @I2@ INDI',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const fam = dataset.records.find((r): r is FamilyRecord => r.tag === 'FAM');
    expect(fam?.events?.map((e) => e.type)).toEqual(['civil']);
    expect(ser551(dataset)).toContain('2 TYPE civil');
  });

  test('Legacy FAM _TAG2–_TAG9 type into FamilyRecord.marks', () => {
    const dataset = parseOk551(
      [...HEADER551, '0 @F1@ FAM', '1 _TAG2 One', '1 _TAG4 Three', ...SUBM, '0 TRLR'].join('\n'),
    );
    const fam = dataset.records.find((r): r is FamilyRecord => r.tag === 'FAM');
    expect(fam?.marks).toEqual(['One', '', 'Three']);
    const text = ser551(dataset);
    expect(text).toContain('1 _TAG2 One');
    expect(text).toContain('1 _TAG4 Three');
  });
});

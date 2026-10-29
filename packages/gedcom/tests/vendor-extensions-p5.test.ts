import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parseOk551(text: string): GedcomDataset {
  const result = parseGedcom551(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }
  return result.value;
}

function parseOk70(text: string): GedcomDataset {
  const result = parseGedcom70(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }
  return result.value;
}

function ser551(dataset: GedcomDataset): string {
  const result = serializeGedcom551(dataset);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }
  return result.value;
}

function ser70(dataset: GedcomDataset): string {
  const result = serializeGedcom70(dataset);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }
  return result.value;
}

const H551 = ['0 HEAD', '1 SOUR DORU', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
const SUBM551 = ['0 @S1@ SUBM', '1 NAME T'];
const H70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0'];

function indi551(body: string[]): string {
  return [...H551, '0 @I1@ INDI', '1 NAME John /Doe/', ...body, ...SUBM551, '0 TRLR'].join('\n');
}

describe('the GES2000 family and individual tags', () => {
  test('the FAM.HUSB/WIFE _NAM/_ZVST/_NR details and the _GODT witnesses', () => {
    const dataset = parseOk551(
      [...H551, '0 @I1@ INDI', '1 NAME John /Doe/', '0 @I2@ INDI', '1 NAME Jane /Doe/', '0 @F1@ FAM', '1 HUSB @I1@', '2 _NAM Hans /Muster/', '2 _ZVST ledig', '2 _NR 2', '1 WIFE @I2@', '1 _MARRNAME Jane /Doe/', '1 _GODT Pate X', ...SUBM551, '0 TRLR'].join('\n'),
    );
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (fam === undefined || fam.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam.husband?.name?.payload).toEqual({ given: 'Hans', surname: 'Muster' });
    expect(fam.husband?.civilStatus).toBe('ledig');
    expect(fam.husband?.marriageNumber).toBe(2);
    expect(fam.wife?.name?.payload).toEqual({ given: 'Jane', surname: 'Doe' });
    expect(fam.witnesses).toEqual(['Pate X']);
    const text = ser551(dataset);
    expect(text).toContain('2 _NAM Hans/Muster/');
    expect(text).toContain('2 _ZVST ledig');
    expect(text).toContain('2 _NR 2');
    // _GODT normalizes into the _WITN spelling of the same slot.
    expect(text).toContain('1 _WITN Pate X');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('the _REL/_NCHI/_NOTH/_SURN/_LEBENSORT facts and names', () => {
    const dataset = parseOk551(
      indi551(['1 _REL a', '1 _NCHI 3', '1 _NOTH Bern', '1 _SURN Meier', '1 _LEBENSORT Zurich']),
    );
    const indi = dataset.records[0];
    if (indi === undefined || indi.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.attributes?.map((a) => [a.tag, a.type])).toEqual([
      ['FACT', 'Child status'], ['FACT', 'Birth order'], ['FACT', 'Heimatort'], ['FACT', 'Lebensort'],
    ]);
    expect(indi.names?.some((n) => n.type?.payload === 'OTHER' && n.type.phrase === 'Clan name')).toBe(true);
    const text = ser551(dataset);
    expect(text).toContain('2 TYPE Child status');
    expect(text).toContain('2 TYPE Birth order');
    expect(text).toContain('2 TYPE Heimatort');
    expect(text).toContain('2 TYPE Lebensort');
    expect(parseOk551(text)).toEqual(dataset);
  });
});

describe('the Ahnenblatt/GEDitCOM header start person and search block', () => {
  test('_HOME/_HME/_NAVI/_NAVM parse and write back', () => {
    const dataset = parseOk551([...H551, '1 _HOME @I1@', '1 _NAVM 2', '0 @I1@ INDI', '1 NAME John /Doe/', ...SUBM551, '0 TRLR'].join('\n'));
    expect(dataset.header.startPerson).toBe('@I1@');
    expect(dataset.header.startPersonMode).toBe('2');
    const text = ser551(dataset);
    expect(text).toContain('1 _HOME @I1@');
    expect(text).toContain('1 _NAVM 2');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('the _INET block and the _ALTPATH file path', () => {
    const dataset = parseOk551(
      [
        ...H551,
        '0 @M1@ OBJE', '1 FILE a.jpg', '2 FORM jpg', '2 _ALTPATH C:/pics',
        '0 @I1@ INDI', '1 NAME John /Doe/',
        '1 _INET', '2 _MHRM 1', '2 _SDATE 2020',
        ...SUBM551, '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    expect(indi?.tag === 'INDI' ? indi.internetSearch : undefined).toEqual({ tag: '_INET', mhrm: '1', searchDate: '2020' });
    const obje = dataset.records.find((r) => r.tag === 'OBJE');
    expect(obje?.tag === 'OBJE' ? obje.files[0]?.alternatePath : undefined).toBe('C:/pics');
    const text = ser551(dataset);
    expect(text).toContain('1 _INET');
    expect(text).toContain('2 _MHRM 1');
    expect(text).toContain('2 _ALTPATH C:/pics');
    expect(parseOk551(text)).toEqual(dataset);
  });
});

describe('the GDO duplicate record, import references and submitter pointers', () => {
  test('the _ALIA record, _IMPF and _SUBM', () => {
    const dataset = parseOk551(
      [
        ...H551,
        '0 @A1@ _ALIA',
        '1 _CPT possible duplicate',
        '1 _INDI @I1@',
        '1 _QUAY 2',
        '1 _STAT open',
        '1 NOTE n',
        '1 SOUR @S2@',
        '0 @S2@ SOUR', '1 TITL S', '1 _SUBM @S1@', '1 _IMPF @S2@', '2 PAGE file-7',
        '0 @I1@ INDI', '1 NAME John /Doe/', '1 _IMPF @I1@', '2 PAGE file-3',
        ...SUBM551,
        '0 TRLR',
      ].join('\n'),
    );
    const alias = dataset.records.find((r) => r.tag === '_ALIA');
    if (alias === undefined || alias.tag !== '_ALIA') {
      throw new Error('expected _ALIA record');
    }
    expect(alias.caption).toBe('possible duplicate');
    expect(alias.individual).toBe('@I1@');
    expect(alias.assessment).toBe('2');
    expect(alias.status).toBe('open');
    const sour = dataset.records.find((r) => r.tag === 'SOUR');
    expect(sour?.tag === 'SOUR' ? sour.submitters : undefined).toEqual(['@S1@']);
    expect(sour?.tag === 'SOUR' ? sour.importReference : undefined).toEqual({ tag: '_IMPF', record: '@S2@', page: 'file-7' });
    const text = ser551(dataset);
    expect(text).toContain('0 @A1@ _ALIA');
    expect(text).toContain('1 _CPT possible duplicate');
    expect(text).toContain('1 _INDI @I1@');
    expect(text).toContain('1 _SUBM @S1@');
    expect(text).toContain('1 _IMPF @S2@');
    expect(parseOk551(text)).toEqual(dataset);
  });
});

describe('the PC-AHNEN, GenPlus, MFT7, FTB and TMG tags', () => {
  test('_URKU, _JAG and _KTIT under SOUR', () => {
    const dataset = parseOk551(
      [...H551, '0 @S2@ SOUR', '1 TITL Book', '1 _URKU', '1 _JAG 1920', '1 _KTIT The Book', ...SUBM551, '0 TRLR'].join('\n'),
    );
    const sour = dataset.records.find((r) => r.tag === 'SOUR');
    if (sour === undefined || sour.tag !== 'SOUR') {
      throw new Error('expected SOUR');
    }
    expect(sour.evidenceAvailable).toBe(true);
    expect(sour.volumeYear).toBe('1920');
    expect(sour.abbreviation).toBe('The Book');
    const text = ser551(dataset);
    expect(text).toContain('1 _URKU Y');
    expect(text).toContain('1 _JAG 1920');
    expect(text).toContain('1 ABBR The Book');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('the MFT7 _COR coordinates and the FTB _PLACE record', () => {
    const dataset = parseOk551(
      [
        ...H551,
        '0 @I1@ INDI', '1 NAME John /Doe/',
        '1 BIRT',
        '2 PLAC Aix',
        '3 _COR',
        '4 _LAD 48',
        '4 _LAM 12',
        '4 _LAN N',
        '4 _LOD 6',
        '4 _LOM 24',
        '4 _LON O',
        '0 @P1@ _PLACE Aix',
        ...SUBM551,
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    const birth = indi?.tag === 'INDI' ? indi.events?.[0] : undefined;
    expect(birth?.detail?.place?.map?.latitude).toEqual({ direction: 'N', degrees: 48.2 });
    expect(birth?.detail?.place?.map?.longitude).toEqual({ direction: 'E', degrees: 6.4 });
    const card = dataset.records.find((r) => r.tag === '_PLAC');
    expect(card?.tag === '_PLAC' ? card.payload : undefined).toBe('Aix');
    const text = ser551(dataset);
    // Standard-first: the coordinates become MAP/LATI/LONG.
    expect(text).toContain('3 MAP');
    expect(text).toContain('4 LATI N48.2');
    expect(text).toContain('4 LONG E6.4');
    // The 5.5.1 projection flattens the payload-dialect place card (see
    // PlaceRecord): the card disappears on 5.5.1 output.
    expect(parseOk551(text).records.some((r) => r.tag === '_PLAC')).toBe(false);
  });

  test('the TMG OBJE under NAME and the TMG _PRIM under _SHAR', () => {
    const dataset = parseOk551(
      [
        ...H551,
        '0 @M1@ OBJE', '1 FILE a.jpg', '2 FORM jpg',
        '0 @I2@ INDI', '1 NAME X /Y/',
        '0 @F1@ FAM', '1 HUSB @I1@', '1 WIFE @I2@',
        '1 MARR',
        '2 _SHAR @I2@',
        '3 _ROLE witness',
        '3 _PRIM Y',
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '2 OBJE @M1@',
        ...SUBM551,
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI' && r.xref === '@I1@');
    expect(indi?.tag === 'INDI' ? indi.names?.[0]?.media?.[0]?.object : undefined).toBe('@M1@');
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    expect(fam?.tag === 'FAM' ? fam.events?.[0]?.detail?.detail?.associations?.[0]?.primary : undefined).toBe(true);
    const text = ser551(dataset);
    expect(text).toContain('2 OBJE @M1@');
    expect(text).toContain('3 _PRIM Y');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('the Reunion AUTH and ANCE tags are accepted generically and preserved', () => {
    const dataset = parseOk551(indi551(['1 AUTH someone', '1 ANCE x']));
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    expect(indi?.tag === 'INDI' ? indi.extensions?.map((e) => e.tag) : undefined).toEqual(['AUTH', 'ANCE']);
    const text = ser551(dataset);
    expect(text).toContain('1 AUTH someone');
    expect(text).toContain('1 ANCE x');
    expect(parseOk551(text)).toEqual(dataset);
  });
});

describe('the 5.5.1 export validity fixes', () => {
  test('the DATE phrase uses the INT parenthesized form', () => {
    const dataset = parseOk70(
      [...H70, '0 @I1@ INDI', '1 NAME John /Doe/', '1 BIRT', '2 DATE 1 JAN 1900', '3 PHRASE calculated', '0 TRLR'].join('\n'),
    );
    dataset.header.source = { payload: 'MyApp' };
    dataset.header.submitter = '@S1@';
    dataset.header.gedcom.form = 'LINEAGE-LINKED';
    dataset.header.gedcom.version = '5.5.1';
    dataset.records.push({ tag: 'SUBM', name: 'T' } as never);
    expect(ser551(dataset)).toContain('2 DATE INT 1 JAN 1900 (calculated)');
  });

  test('7.0 input rejects SEX N', () => {
    const result = parseGedcom70(enc([...H70, '0 @I1@ INDI', '1 NAME John /Doe/', '1 SEX N', '0 TRLR'].join('\n')));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('enum.invalid-value');
    }
  });

  test('7.0 input rejects a PHRASE directly under FAMC', () => {
    const result = parseGedcom70(enc([...H70, '0 @F1@ FAM', '1 HUSB @I1@', '0 @I1@ INDI', '1 NAME John /Doe/', '1 FAMC @F1@', '2 PHRASE x', '0 TRLR'].join('\n')));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('structure.unknown-tag');
    }
  });

  test('5.5.1 output never spells a PHRASE', () => {
    const dataset = parseOk70(
      [
        ...H70,
        '0 @I2@ INDI', '1 NAME Jane /Doe/',
        '0 @F1@ FAM', '1 HUSB @I1@', '2 PHRASE husband phrase', '1 CHIL @I2@', '2 PHRASE child phrase',
        '0 @I1@ INDI', '1 NAME John /Doe/', '1 FAMS @F1@', '2 NOTE n',
        '1 BIRT', '2 DATE 1 JAN 1900', '3 PHRASE birth phrase',
        '1 ASSO @I2@', '2 PHRASE at the baptism', '2 ROLE GODP',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).not.toContain('PHRASE');
    const dataset2 = parseOk70(
      [...H70, '0 @F1@ FAM', '1 HUSB @I1@', '0 @I1@ INDI', '1 NAME John /Doe/', '1 FAMC @F1@', '2 PEDI BIRTH', '3 PHRASE pedi phrase', '0 TRLR'].join('\n'),
    );
    expect(ser551(dataset2)).not.toContain('PHRASE');
  });

  test('the 5.5.1 version gate accepts only 5.5, 5.5.1 and 5.5.5', () => {
    for (const bad of ['5.5.2', '5.5.9', '5.5.0']) {
      const result = parseGedcom551(
        enc(['0 HEAD', '1 SOUR DORU', '1 SUBM @S1@', '1 GEDC', `2 VERS ${bad}`, '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', ...SUBM551, '0 TRLR'].join('\n')),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('document.wrong-version');
      }
    }
  });
});

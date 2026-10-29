import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type {
  GedcomDataset,
  IndividualRecord,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
} from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

/** The serializers emit CRLF line endings. */
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

describe('cross-reference identifiers on tagged extension structures', () => {
  test('an xref on a nested extension structure is kept and written back (5.5.1)', () => {
    const text = [
      ...H551,
      '0 @I1@ INDI',
      '1 _WRAP',
      '2 @X1@ _INNER text',
      ...SUBM,
      '0 TRLR',
    ].join('\n');
    const dataset = parseOk551(text);
    const person = indi(dataset);
    expect(person.extensions?.[0]?.children?.[0]?.xref).toBe('@X1@');
    const out = ser551(dataset);
    expect(lines(out)).toContain('2 @X1@ _INNER text');
    expect(parseOk551(out)).toEqual(dataset);
  });

  test('an xref on a nested extension structure is kept and written back (7.0)', () => {
    const text = [
      ...H70,
      '1 SCHMA',
      '2 TAG _STRUCT http://example.com/substructure-type',
      '0 @I1@ INDI',
      '1 _STRUCT',
      '2 @E1@ _INNER data',
      '0 TRLR',
    ].join('\n');
    const dataset = parseOk70(text);
    const person = indi(dataset);
    expect(person.extensions?.[0]?.children?.[0]?.xref).toBe('@E1@');
    const out = ser70(dataset);
    expect(lines(out)).toContain('2 @E1@ _INNER data');
    expect(parseOk70(out)).toEqual(dataset);
  });
});

describe('the Legacy SOUR report flags', () => {
  const SAMPLE = [
    ...H551,
    '0 @S2@ SOUR',
    '1 TITL A Book',
    '1 _TAG NO',
    '1 _TAG2 YES',
    '1 _TAG3 NO',
    '1 _TAG4 YES',
    ...SUBM,
    '0 TRLR',
  ].join('\n');

  test('types the four flags on the source record', () => {
    const dataset = parseOk551(SAMPLE);
    const source = dataset.records.find((entry) => entry.tag === 'SOUR') as SourceRecord;
    expect(source.citationDetailIncluded).toBe(false);
    expect(source.citationIncluded).toBe(true);
    expect(source.citationDetailTextIncluded).toBe(false);
    expect(source.citationDetailNotesIncluded).toBe(true);
    expect(source.extensions).toBeUndefined();
  });

  test('writes the flags back with the YES/NO spellings and round-trips', () => {
    const dataset = parseOk551(SAMPLE);
    const out = ser551(dataset);
    expect(lines(out)).toContain('1 _TAG NO');
    expect(lines(out)).toContain('1 _TAG2 YES');
    expect(lines(out)).toContain('1 _TAG3 NO');
    expect(lines(out)).toContain('1 _TAG4 YES');
    expect(parseOk551(out)).toEqual(dataset);
    // 7.0 spells the underscore tags too.
    expect(parseOk70(ser70(dataset))).toEqual(parseOk70(ser70(parseOk551(SAMPLE))));
  });

  test('a value other than YES/NO is a strict error', () => {
    const result = parseGedcom551(enc([...H551, '0 @S2@ SOUR', '1 _TAG YEP', ...SUBM, '0 TRLR'].join('\n')));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result.error as { code: string }).code).toBe('enum.invalid-value');
    }
  });
});

describe('the USM6 (Der Stammbaum ≤ V6) tags', () => {
  const SAMPLE = [
    ...H551,
    '0 @I1@ INDI',
    '1 SIGN 1',
    '1 NAME Anna /Müller/',
    '2 UGNM Anna',
    '2 NAME_ Müller, Mueller',
    '1 BIRT',
    '2 BTYP 2',
    '2 POTM 0',
    '2 SRCH City Archive',
    '2 NOTRY N. Notary',
    '1 BURI',
    '2 AGED 74',
    '2 SOUR @S2@',
    '3 RINI J. Finder',
    '1 NCHI 2',
    '2 SURE 1',
    '1 FAMC @F1@',
    '2 MTYP 2',
    '2 _HUSB step',
    '2 _WIFE natural',
    '0 @F1@ FAM',
    '1 UTYP 2',
    '1 NCHI 2',
    '2 SURE 1',
    '0 @S2@ SOUR',
    '1 TITL Records',
    ...SUBM,
    '0 TRLR',
  ].join('\n');

  test('types every USM6 tag into the model', () => {
    const dataset = parseOk551(SAMPLE);
    const person = indi(dataset);
    expect(person.canSign).toBe(true);
    const name = person.names?.[0];
    expect(name?.callName).toBe('Anna');
    expect(name?.surnameVariants).toBe('Müller, Mueller');
    const birth = person.events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.tag === 'BIRT' ? birth.birthType : undefined).toBe('2');
    expect(birth?.detail?.posthumous).toBe(false);
    expect(birth?.detail?.furtherResearch).toBe('City Archive');
    expect(birth?.detail?.notary).toBe('N. Notary');
    const burial = person.events?.find((entry) => entry.tag === 'BURI');
    expect(burial?.detail?.age?.payload).toEqual({ years: 74 });
    const nchi = person.attributes?.find((entry) => entry.tag === 'NCHI');
    expect(nchi?.tag === 'NCHI' ? nchi.childCountCertain : undefined).toBe(true);
    const famc = person.childFamilies?.[0];
    expect(famc?.parentalRelationKind).toBe('2');
    expect(famc?.fatherChildStatus).toBe('step');
    expect(famc?.motherChildStatus).toBe('natural');
    const fam = dataset.records.find((entry) => entry.tag === 'FAM');
    expect(fam?.tag === 'FAM' ? fam.unionKind : undefined).toBe('2');
    expect(fam?.tag === 'FAM' ? fam.attributes?.[0]?.childCountCertain : undefined).toBe(true);
    const citation = burial?.detail?.citations?.[0];
    expect(citation?.foundBy).toBe('J. Finder');
  });

  test('writes the USM6 spellings back on 5.5.1 and round-trips', () => {
    const dataset = parseOk551(SAMPLE);
    const out = lines(ser551(dataset));
    expect(out).toContain('1 SIGN 1');
    expect(out).toContain('2 _RUFNAME Anna'); // UGNM normalizes into the callName slot
    expect(out).toContain('2 NAME_ Müller, Mueller');
    expect(out).toContain('2 BTYP 2');
    expect(out).toContain('2 POTM 0');
    expect(out).toContain('2 SRCH City Archive');
    expect(out).toContain('2 NOTRY N. Notary');
    expect(out).toContain('2 AGE 74y'); // AGED normalizes into the standard AGE
    expect(out).toContain('2 SURE 1');
    expect(out).toContain('2 MTYP 2');
    expect(out).toContain('2 _HUSB step');
    expect(out).toContain('2 _WIFE natural');
    expect(out).toContain('1 UTYP 2');
    expect(out).toContain('3 RINI J. Finder');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });

  test('the 5.x-only spellings are dropped on 7.0 export and strict on 7.0 input', () => {
    const dataset = parseOk551(SAMPLE);
    const out = lines(ser70(dataset)).join('\n');
    for (const tag of ['SIGN', 'BTYP', 'POTM', 'SRCH', 'NOTRY', 'SURE', 'MTYP', 'UTYP', 'RINI', 'UGNM', 'NAME_']) {
      expect(out, tag).not.toContain(tag);
    }
    // The standard slots survive in their 7.0 spellings.
    expect(out).toContain('2 AGE 74y');
    expect(out).toContain('2 _HUSB step');
    expect(out).toContain('2 _WIFE natural');
    // 7.0 input stays strict for the non-underscore tags.
    for (const tag of ['SIGN', 'BTYP', 'MTYP', 'UTYP', 'SURE', 'POTM', 'SRCH', 'AGED', 'NOTRY', 'RINI', 'UGNM', 'NAME_', 'SECG']) {
      const result = parseGedcom70(enc([...H70, '0 @I1@ INDI', `1 ${tag} x`, '0 TRLR'].join('\n')));
      expect(result.ok, tag).toBe(false);
      if (!result.ok) {
        expect((result.error as { code: string }).code, tag).toBe('structure.unknown-tag');
      }
    }
  });
});

describe('the Ancestral Quest tags', () => {
  test('_MASTER under SOUR types into masterListing', () => {
    const text = [...H551, '0 @S2@ SOUR', '1 TITL A Book', '1 _MASTER', ...SUBM, '0 TRLR'].join('\n');
    const dataset = parseOk551(text);
    const source = dataset.records.find((entry) => entry.tag === 'SOUR') as SourceRecord;
    expect(source.masterListing).toBe(true);
    expect(lines(ser551(dataset))).toContain('1 _MASTER Y');
    expect(lines(ser70(dataset))).toContain('1 _MASTER Y');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });

  test('_MASTER N clears the flag and is not written back', () => {
    const text = [...H551, '0 @S2@ SOUR', '1 TITL A Book', '1 _MASTER N', ...SUBM, '0 TRLR'].join('\n');
    const dataset = parseOk551(text);
    const source = dataset.records.find((entry) => entry.tag === 'SOUR') as SourceRecord;
    expect(source.masterListing).toBe(false);
    expect(lines(ser551(dataset)).join('\n')).not.toContain('_MASTER');
  });
});

describe('the Mac Family Tree 7 tags', () => {
  test('_BKM and _STP type into the individual flags', () => {
    const text = [...H551, '0 @I1@ INDI', '1 _BKM', '1 _STP Y', ...SUBM, '0 TRLR'].join('\n');
    const dataset = parseOk551(text);
    const person = indi(dataset);
    expect(person.bookmarked).toBe(true);
    expect(person.startPerson).toBe(true);
    expect(lines(ser551(dataset))).toContain('1 _BKM Y');
    expect(lines(ser551(dataset))).toContain('1 _STP Y');
    expect(lines(ser70(dataset))).toContain('1 _BKM Y');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });

  test('_QUAL under SOUR types into the quality block', () => {
    const text = [
      ...H551,
      '0 @S2@ SOUR',
      '1 TITL A Book',
      '1 _QUAL',
      '2 _SOUR 5',
      '2 _INFO 4',
      '2 _EVID 3',
      ...SUBM,
      '0 TRLR',
    ].join('\n');
    const dataset = parseOk551(text);
    const source = dataset.records.find((entry) => entry.tag === 'SOUR') as SourceRecord;
    expect(source.quality).toEqual({ tag: '_QUAL', source: '5', information: '4', evidence: '3' });
    const out551 = lines(ser551(dataset));
    expect(out551).toContain('1 _QUAL');
    expect(out551).toContain('2 _SOUR 5');
    expect(out551).toContain('2 _INFO 4');
    expect(out551).toContain('2 _EVID 3');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
    expect(parseOk70(ser70(dataset))).toEqual(parseOk70(ser70(parseOk551(text))));
  });
});

describe('the Family Historian tags', () => {
  const SAMPLE = [
    ...H551,
    '0 @I1@ INDI',
    '1 _FLGS',
    '2 __1871_CENSUS 1871 Census',
    '2 __LIVING Living',
    '1 NAME Anthony Edward /Munro/',
    '2 _USED Tony',
    '1 BIRT',
    '2 _FLGS',
    '3 __PREFERRED Preferred',
    '3 __PRIVATE Private',
    '2 _SHAN J. Witness',
    '2 _EMAIL me@@example.com',
    '2 _WEB https://example.com',
    '2 SOUR @S2@',
    '3 _QUAY 0x98',
    '3 _FIELD TX-PAGE',
    '4 TEXT Page 321',
    '0 @S2@ SOUR',
    '1 TITL A Book',
    '1 _TYPE Census',
    '0 @R1@ REPO',
    '1 NAME An Archive',
    '1 _EMAIL repo@@example.com',
    '1 _WEB https://repo.example.com',
    '0 @S1@ SUBM',
    '1 NAME Tester',
    '1 _EMAIL tester@@example.com',
    '0 TRLR',
  ].join('\n');

  test('types every FH tag into the model', () => {
    const dataset = parseOk551(SAMPLE);
    const person = indi(dataset);
    expect(person.recordFlags).toEqual([
      { tag: '__1871_CENSUS', name: '1871 Census' },
      { tag: '__LIVING', name: 'Living' },
    ]);
    expect(person.names?.[0]?.givenNameUsed).toBe('Tony');
    const birth = person.events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.factFlags).toEqual(['PREFERRED', 'PRIVATE']);
    expect(birth?.detail?.witnesses).toEqual(['J. Witness']);
    expect(birth?.detail?.email).toEqual(['me@example.com']);
    expect(birth?.detail?.www).toEqual(['https://example.com']);
    const citation = birth?.detail?.citations?.[0];
    expect(citation?.assessment).toBe('0x98');
    expect(citation?.metafields).toEqual([{ tag: '_FIELD', name: 'TX-PAGE', text: 'Page 321' }]);
    const source = dataset.records.find((entry) => entry.tag === 'SOUR') as SourceRecord;
    expect(source.sourceType).toBe('Census');
    const repo = dataset.records.find((entry) => entry.tag === 'REPO') as RepositoryRecord;
    expect(repo.email).toEqual(['repo@example.com']);
    expect(repo.www).toEqual(['https://repo.example.com']);
    const submitters = dataset.records.filter((entry): entry is SubmitterRecord => entry.tag === 'SUBM');
    expect(submitters.some((entry) => entry.email?.[0] === 'tester@example.com')).toBe(true);
  });

  test('writes the FH spellings back on 5.5.1 and round-trips', () => {
    const dataset = parseOk551(SAMPLE);
    const out = lines(ser551(dataset));
    expect(out).toContain('1 _FLGS');
    expect(out).toContain('2 __1871_CENSUS 1871 Census');
    expect(out).toContain('2 __LIVING Living');
    expect(out).toContain('2 _USED Tony');
    expect(out).toContain('2 _FLGS');
    expect(out).toContain('3 __PREFERRED Preferred');
    expect(out).toContain('3 __PRIVATE Private');
    expect(out).toContain('2 _WITN J. Witness');
    expect(out).toContain('2 _EMAIL me@@example.com');
    expect(out).toContain('2 _WEB https://example.com');
    expect(out).toContain('3 _QUAY 0x98');
    expect(out).toContain('3 _FIELD TX-PAGE');
    expect(out).toContain('4 TEXT Page 321');
    expect(out).toContain('1 _TYPE Census');
    // Without an address block the 5.5.1 record has no standard contact
    // slot (the contacts live inside the ADDRESS_STRUCTURE), so the FH
    // spellings `_EMAIL`/`_WEB` carry them back.
    expect(out).toContain('1 _EMAIL repo@@example.com');
    expect(out).toContain('1 _WEB https://repo.example.com');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });

  test('7.0 spells the standard slots and keeps the underscore extensions', () => {
    const dataset = parseOk551(SAMPLE);
    const out = lines(ser70(dataset));
    expect(out).toContain('1 _FLGS');
    expect(out).toContain('2 __1871_CENSUS 1871 Census');
    expect(out).toContain('2 _FLGS');
    expect(out).toContain('3 __PRIVATE Private');
    expect(out).toContain('2 _WITN J. Witness');
    expect(out).toContain('2 EMAIL me@example.com');
    expect(out).toContain('2 WWW https://example.com');
    expect(out).toContain('3 _QUAY 0x98');
    expect(out).toContain('1 _TYPE Census');
    const parsed70 = parseOk70(ser70(dataset));
    const person = indi(parsed70);
    expect(person.recordFlags).toEqual(dataset.records.find((entry) => entry.tag === 'INDI')?.tag === 'INDI' ? indi(dataset).recordFlags : undefined);
    const birth = person.events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.factFlags).toEqual(['PREFERRED', 'PRIVATE']);
    expect(birth?.detail?.email).toEqual(['me@example.com']);
    expect(parseOk70(ser70(parsed70))).toEqual(parsed70);
  });
});

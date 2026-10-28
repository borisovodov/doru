import { describe, expect, test } from 'vitest';
import {
  LEGACY_FAMILY_TAGS,
  LEGACY_GENERIC_TAGS,
  LEGACY_INDIVIDUAL_TAGS,
  NON_UNDERSCORE_VENDOR_TAGS,
} from '../src/index';
import type { LegacyIndividualRule } from '../src/index';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { ExtensionRecord, FamilyRecord, GedcomDataset, IndividualRecord } from '../src/structures';

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

function err70(text: string): string {
  const result = parseGedcom70(enc(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
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

const H551 = ['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
const SUBM = ['0 @S1@ SUBM', '1 NAME T'];
const H70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0'];

function indi551(lines: string[]): string {
  return [...H551, '0 @I1@ INDI', ...lines, ...SUBM, '0 TRLR'].join('\n');
}

function indi70(lines: string[]): string {
  return [...H70, '0 @I1@ INDI', ...lines, '0 TRLR'].join('\n');
}

/** Tags whose position under INDI is standard (a handler exists in
 *  every version), so they are not legacy-tag errors on 7.0 input. */
const STANDARD_POSITION_TAGS = new Set(['IDNO', 'NATI', 'SUBM', 'CREA']);

/** The line value used for the tag in the uniform round-trip loop. */
function sampleValue(rule: LegacyIndividualRule): string | undefined {
  switch (rule.kind) {
    case 'negative':
    case 'standardEvent':
    case 'lds':
      return undefined;
    case 'attribute':
      return rule.tag === 'NMR' ? '2' : 'x';
    default:
      return 'x';
  }
}

/** Asserts the typed normalization of one rule (text-payload path). */
function expectTyped(dataset: GedcomDataset, tag: string, rule: LegacyIndividualRule, value: string | undefined): void {
  const indi = dataset.records.find((record): record is IndividualRecord => record.tag === 'INDI');
  expect(indi, tag).toBeDefined();
  const record = indi as IndividualRecord;
  expect(record.extensions?.some((entry) => entry.tag === tag), `${tag}: must not stay generic`).toBeFalsy();
  switch (rule.kind) {
    case 'name': {
      const name = record.names?.at(-1);
      expect(name?.type?.payload, tag).toBe(rule.nameType);
      expect(name?.payload.given, tag).toBe(value);
      return;
    }
    case 'nameOther': {
      const name = record.names?.at(-1);
      expect(name?.type?.payload, tag).toBe('OTHER');
      expect(name?.type?.phrase, tag).toBe(rule.phrase);
      expect(name?.payload.given, tag).toBe(value);
      return;
    }
    case 'standardEvent':
      expect(record.events?.some((event) => event.tag === rule.tag), tag).toBe(true);
      return;
    case 'event': {
      const event = record.events?.find((entry) => entry.tag === 'EVEN' && entry.type === rule.type);
      expect(event?.payload, tag).toBe(value);
      return;
    }
    case 'fact': {
      const attribute = record.attributes?.find((entry) => entry.tag === 'FACT' && entry.type === rule.type);
      expect(attribute?.payload, tag).toBe(value);
      return;
    }
    case 'educ': {
      const attribute = record.attributes?.find((entry) => entry.tag === 'EDUC' && entry.type === rule.type);
      expect(attribute?.payload, tag).toBe(value);
      return;
    }
    case 'attribute':
      expect(record.attributes?.some((entry) => entry.tag === rule.tag), tag).toBe(true);
      return;
    case 'note':
      expect(record.notes?.some((entry) => entry.tag === 'NOTE' && 'payload' in entry && entry.payload === value), tag).toBe(true);
      return;
    case 'privateNote':
      expect(record.notes?.some((entry) => entry.tag === 'NOTE' && 'payload' in entry && entry.payload === value && entry.private === true), tag).toBe(true);
      return;
    case 'negative':
      expect(record.nonEvents?.map((entry) => entry.payload), tag).toContain(rule.event);
      return;
    case 'url':
      expect(record.url, tag).toBe(value);
      return;
    case 'refn':
      expect(record.identifiers?.some((entry) => entry.tag === 'REFN' && entry.payload === value), tag).toBe(true);
      return;
    case 'association':
      // Text payload: FACT + TYPE (the pointer path is covered below).
      expect(record.attributes?.some((entry) => entry.tag === 'FACT' && entry.type === rule.relationship && entry.payload === value), tag).toBe(true);
      return;
    case 'fsftid':
      expect(record.familySearchId, tag).toBe(value);
      return;
    case 'lds':
      return;
  }
}

describe('non-underscore vendor tags of GEDCOM 5.x (Legacy "Tags Not Specified in GEDCOM 5.5")', () => {
  test('the catalog covers every documented tag', () => {
    // 121 from docs/vendor-extensions.md chapter 8 plus the 10 entries
    // of the Legacy catalog the chapter missed (COMP, CUTOFFYR, DATV,
    // EARL, HISTB, MIDSC, ORIG, RATI, STAKE, WEIG) — 131 in total —
    // plus the 22 GenWiki "Tabelle 2" deviations of USM6 / MFT7/MFT8
    // (AGED, BTYP, CREA, DEED, FPRF, MISE, MPRF, MRCI, MRRE, MTYP,
    // NAME_, NOTRY, POTM, PRIV, RECT, RINI, SECG, SIGN, SRCH, SURE,
    // UGNM, UTYP) and the RootsMagic `FSFTID`.
    expect(NON_UNDERSCORE_VENDOR_TAGS.size).toBe(154);
    expect(LEGACY_GENERIC_TAGS.size).toBe(32);
  });

  test('types every rule-bearing tag into the model on 5.5.1 input', () => {
    for (const [tag, rule] of Object.entries(LEGACY_INDIVIDUAL_TAGS)) {
      if (rule.kind === 'lds') {
        continue; // Needs children; covered by its own test.
      }
      const value = sampleValue(rule);
      const line = value === undefined ? `1 ${tag}` : `1 ${tag} ${value}`;
      expectTyped(parseOk551(indi551([line])), tag, rule, value);
    }
  });

  test('keeps the undocumented tail generic, preserved verbatim', () => {
    // SIGN is typed at the INDI position (see IndividualRecord.canSign);
    // the other tags are typed only in their documented positions, so an
    // INDI-level occurrence stays generic.
    for (const tag of LEGACY_GENERIC_TAGS) {
      if (tag === 'SIGN') {
        continue;
      }
      const dataset = parseOk551(indi551([`1 ${tag} x`]));
      const indi = dataset.records.find((record): record is IndividualRecord => record.tag === 'INDI');
      const extension = (indi as IndividualRecord).extensions?.find((entry) => entry.tag === tag);
      expect(extension?.payload, tag).toBe('x');
    }
  });

  test('NOTP normalizes into a private NOTE and is written back as NOTE + _PRIV Y', () => {
    const dataset = parseOk551(indi551(['1 NOTP secret text']));
    const indi = dataset.records.find((record): record is IndividualRecord => record.tag === 'INDI');
    expect((indi as IndividualRecord).notes?.[0]).toEqual({ tag: 'NOTE', payload: 'secret text', private: true });
    const out551 = lines(ser551(dataset));
    expect(out551).toContain('1 NOTE secret text');
    expect(out551).toContain('2 _PRIV Y');
    expect(out551.join('\n')).not.toContain('NOTP');
    const out70 = lines(ser70(dataset));
    expect(out70).toContain('1 NOTE secret text');
    expect(out70).toContain('2 _PRIV Y');
  });

  test('_PRIV under NOTE sets and clears the privacy flag (both versions)', () => {
    const marked = parseOk70(indi70(['1 NOTE text', '2 _PRIV Y']));
    const indi = marked.records.find((record): record is IndividualRecord => record.tag === 'INDI');
    expect((indi as IndividualRecord).notes?.[0]).toEqual({ tag: 'NOTE', payload: 'text', private: true });
    const cleared = parseOk551(indi551(['1 NOTE text', '2 _PRIV N']));
    const indi55 = cleared.records.find((record): record is IndividualRecord => record.tag === 'INDI');
    expect((indi55 as IndividualRecord).notes?.[0]).toEqual({ tag: 'NOTE', payload: 'text', private: false });
    // A cleared flag is not written back.
    expect(lines(ser551(cleared)).join('\n')).not.toContain('_PRIV');
  });

  test('NOTP stays a strict error on 7.0 input (non-underscore)', () => {
    expect(err70(indi70(['1 NOTP secret']))).toBe('structure.unknown-tag');
  });

  test('a standard position still parses as the standard structure', () => {
    const dataset = parseOk551(
      indi551(['1 NATI German', '1 SUBM @S1@', '1 IDNO 123', '2 TYPE Passport', '0 @F1@ FAM', '1 WIFE @I2@', '0 @I2@ INDI']),
    );
    const indi = dataset.records.find((record): record is IndividualRecord => record.tag === 'INDI');
    expect(indi?.attributes?.map((attribute) => attribute.tag)).toEqual(['NATI', 'IDNO']);
    expect(indi?.submitters).toEqual(['@S1@']);
    expect((indi as IndividualRecord).extensions).toBeUndefined();
    const fam = dataset.records.find((record) => record.tag === 'FAM');
    expect(fam && 'wife' in fam && fam.wife?.partner).toBe('@I2@');
  });

  test('a pointer payload becomes an ASSO with the RELA descriptor', () => {
    const dataset = parseOk551(indi551(['1 FATH @I2@', '0 @I2@ INDI']));
    const indi = dataset.records.find((record): record is IndividualRecord => record.tag === 'INDI');
    expect((indi as IndividualRecord).associations).toEqual([
      { tag: 'ASSO', individual: '@I2@', relationship: 'Father' },
    ]);
    expect(lines(ser551(dataset))).toContain('1 ASSO @I2@');
    expect(lines(ser551(dataset))).toContain('2 RELA Father');
    expect(lines(ser70(dataset))).toContain('2 ROLE OTHER');
    expect(lines(ser70(dataset))).toContain('3 PHRASE Father');
  });

  test('the FTM5 LDS wrapper parses its children as ordinances', () => {
    const dataset = parseOk551(
      indi551(['1 LDS', '2 BAPL', '3 DATE 1 JAN 1900', '3 TEMP SLAKE', '2 ENDL', '2 SLGC', '3 FAMC @F1@', '0 @F1@ FAM']),
    );
    const indi = dataset.records.find((record): record is IndividualRecord => record.tag === 'INDI');
    expect((indi as IndividualRecord).ordinances?.map((ordinance) => ordinance.tag)).toEqual(['BAPL', 'ENDL', 'SLGC']);
    const text = ser551(dataset);
    expect(lines(text)).toContain('1 BAPL');
    expect(lines(text)).toContain('2 DATE 1 JAN 1900');
    expect(text).not.toContain('LDS');
  });

  test('types the FAM-level rules', () => {
    const text = [...H551, '0 @F1@ FAM', '1 CLAW', '2 DATE 1900', '1 SEPA', '1 FEMA 2', '1 MALE 3', ...SUBM, '0 TRLR'].join('\n');
    const dataset = parseOk551(text);
    const fam = dataset.records.find((record): record is FamilyRecord => record.tag === 'FAM');
    expect(fam?.events).toEqual([
      { tag: 'MARR', type: 'Common law marriage', detail: { detail: { date: expect.anything() } } },
      { tag: 'EVEN', payload: '', type: 'Separated' },
      { tag: 'EVEN', payload: '2', type: 'Female children' },
      { tag: 'EVEN', payload: '3', type: 'Male children' },
    ]);
    const output = ser551(dataset);
    expect(lines(output)).toContain('1 MARR');
    expect(lines(output)).toContain('2 TYPE Common law marriage');
    expect(lines(output)).toContain('1 EVEN 2');
    expect(lines(output)).toContain('2 TYPE Female children');
  });

  test('exports the typed constructs standard-first in both versions', () => {
    const dataset = parseOk551(indi551(['1 CIRC x', '1 URL http://example', '1 UMAR', '1 NMAR 2', '1 BLESS']));
    const text551 = ser551(dataset);
    expect(lines(text551)).toContain('1 EVEN x');
    expect(lines(text551)).toContain('2 TYPE Circumcision');
    expect(lines(text551)).toContain('1 _URL http://example');
    expect(lines(text551)).toContain('1 _NMAR');
    expect(lines(text551)).toContain('1 NMR 2');
    expect(lines(text551)).toContain('1 BLES');
    expect(text551).not.toContain('CIRC');
    const text70 = ser70(dataset);
    expect(lines(text70)).toContain('1 EVEN x');
    expect(lines(text70)).toContain('1 NO MARR');
    expect(lines(text70)).toContain('1 NMR 2');
    expect(lines(text70)).toContain('1 BLES');
  });

  test('round-trips the whole catalog through 5.5.1 losslessly', () => {
    const input: string[] = [];
    for (const [tag, rule] of Object.entries(LEGACY_INDIVIDUAL_TAGS)) {
      if (rule.kind === 'lds') {
        continue;
      }
      const value = sampleValue(rule);
      input.push(value === undefined ? `1 ${tag}` : `1 ${tag} ${value}`);
    }
    const dataset = parseOk551(indi551(input));
    const reparsed = parseOk551(ser551(dataset));
    expect(reparsed).toEqual(dataset);
  });

  test('keeps 7.0 input strict for every legacy tag', () => {
    for (const tag of NON_UNDERSCORE_VENDOR_TAGS) {
      if (STANDARD_POSITION_TAGS.has(tag)) {
        continue; // These are standard 7.0 INDI tags; the loop covers the legacy set.
      }
      const result = parseGedcom70(enc(indi70([`1 ${tag} x`])));
      if (result.ok) {
        throw new Error(`expected ${tag} to fail on 7.0 input`);
      }
      expect(result.error.code, tag).toBe('structure.unknown-tag');
    }
  });

  test('unknown non-underscore tags remain strict errors on 5.5.1 input', () => {
    const result = parseGedcom551(enc(indi551(['1 ZZXQ x'])));
    if (result.ok) {
      throw new Error('expected ZZXQ to fail');
    }
    expect(result.error.code).toBe('structure.unknown-tag');
  });

  test('record-level tags become ExtensionRecords with their xref, dropped on 7.0', () => {
    const text = [...H551, '0 @X1@ LDS', '1 CHIL @I1@', '0 @I1@ INDI', ...SUBM, '0 TRLR'].join('\n');
    const dataset = parseOk551(text);
    const record = dataset.records.find((entry) => entry.tag === 'LDS');
    expect(record).toBeDefined();
    expect((record as ExtensionRecord).xref).toBe('@X1@');
    const output = ser551(dataset);
    expect(lines(output)).toContain('0 @X1@ LDS');
    expect(lines(output)).toContain('1 CHIL @I1@');
    expect(parseOk551(output)).toEqual(dataset);
    expect(ser70(dataset)).not.toContain('@X1@ LDS');
  });

  test('nested generic children round-trip verbatim, order preserved', () => {
    const text = indi551(['1 DETS something', '2 _TAG alpha', '2 HISTB field notes']);
    const dataset = parseOk551(text);
    const indi = dataset.records.find((record): record is IndividualRecord => record.tag === 'INDI');
    const extension = (indi as IndividualRecord).extensions?.find((entry) => entry.tag === 'DETS');
    expect(extension?.children.map((child) => child.tag)).toEqual(['_TAG', 'HISTB']);
    const output = ser551(dataset);
    expect(lines(output)).toContain('2 _TAG alpha');
    expect(lines(output)).toContain('2 HISTB field notes');
    expect(parseOk551(output)).toEqual(dataset);
  });

  test('a TYPE child overrides the default fact type (ATTR)', () => {
    const dataset = parseOk551(indi551(['1 ATTR x', '2 TYPE Clergy']));
    const indi = dataset.records.find((record): record is IndividualRecord => record.tag === 'INDI');
    expect((indi as IndividualRecord).attributes).toEqual([
      { tag: 'FACT', payload: 'x', type: 'Clergy' },
    ]);
  });

  test('legacy events keep their payload and accept DATE and AGE details', () => {
    const dataset = parseOk551(indi551(['1 MILF 5th Infantry', '2 DATE 1945', '2 AGE 20y']));
    const indi = dataset.records.find((record): record is IndividualRecord => record.tag === 'INDI');
    const event = (indi as IndividualRecord).events?.find((entry) => entry.type === 'Military service');
    expect(event?.payload).toBe('5th Infantry');
    expect(event?.detail?.date).toBeDefined();
    expect(event?.detail?.age?.payload).toEqual({ years: 20 });
    // A bare Y assertion is dropped from the payload.
    const asserted = parseOk551(indi551(['1 MILT Y']));
    const indi2 = asserted.records.find((record): record is IndividualRecord => record.tag === 'INDI');
    const event2 = (indi2 as IndividualRecord).events?.find((entry) => entry.type === 'Military');
    expect(event2?.payload).toBe('');
  });

  test('a legacy person link rejects substructures', () => {
    const result = parseGedcom551(enc(indi551(['1 FATH @I2@', '2 NOTE x', '0 @I2@ INDI'])));
    if (result.ok) {
      throw new Error('expected FATH with a child to fail');
    }
    expect(result.error.code).toBe('structure.unknown-tag');
  });

  test('the LDS wrapper falls back to extensions and rejects unknown tags', () => {
    const dataset = parseOk551(indi551(['1 LDS', '2 BAPL', '2 _FOO x']));
    const indi = dataset.records.find((record): record is IndividualRecord => record.tag === 'INDI');
    expect((indi as IndividualRecord).ordinances?.map((ordinance) => ordinance.tag)).toEqual(['BAPL']);
    expect((indi as IndividualRecord).extensions?.map((entry) => entry.tag)).toEqual(['_FOO']);
    const bad = parseGedcom551(enc(indi551(['1 LDS', '2 BOGUS x'])));
    if (bad.ok) {
      throw new Error('expected BOGUS under LDS to fail');
    }
    expect(bad.error.code).toBe('structure.unknown-tag');
  });

  test('a legacy note tag requires a text payload', () => {
    const result = parseGedcom551(enc(indi551(['1 HIST'])));
    if (result.ok) {
      throw new Error('expected a bare HIST to fail');
    }
    expect(result.error.code).toBe('structure.missing-payload');
  });

  test('a Y assertion on a FAM count fact is dropped from the payload', () => {
    const dataset = parseOk551(indi551(['0 @F1@ FAM', '1 FEMA Y', '0 @I2@ INDI']));
    const fam = dataset.records.find((record): record is FamilyRecord => record.tag === 'FAM');
    expect(fam?.events).toEqual([{ tag: 'EVEN', payload: '', type: 'Female children' }]);
  });
});

import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { EventDefinitionRecord, FamilyRecord, GedcomDataset, IndividualRecord, SourceCitation } from '../src/structures';

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

const H551 = ['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
const SUBM = ['0 @S1@ SUBM', '1 NAME T'];
const H70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0'];

function fam551(lines: string[]): string {
  return [...H551, '0 @F1@ FAM', ...lines, ...SUBM, '0 TRLR'].join('\n');
}

function fam70(lines: string[]): string {
  return [...H70, '0 @F1@ FAM', ...lines, '0 TRLR'].join('\n');
}

function indi551(lines: string[]): string {
  return [...H551, '0 @I1@ INDI', ...lines, ...SUBM, '0 TRLR'].join('\n');
}

function indi70(lines: string[]): string {
  return [...H70, '0 @I1@ INDI', ...lines, '0 TRLR'].join('\n');
}

describe('the FTW marriage statuses _MSTAT/_MEND under FAM', () => {
  test('parses and round-trips in both versions', () => {
    for (const parseOk of [parseOk551, parseOk70]) {
      const sample = parseOk === parseOk551 ? fam551 : fam70;
      const ser = parseOk === parseOk551 ? ser551 : ser70;
      const dataset = parseOk(sample(['1 HUSB @I1@', '1 WIFE @I2@', '1 _MSTAT Friends', '1 _MEND Widowed', '0 @I1@ INDI', '0 @I2@ INDI']));
      const fam = dataset.records.find((record): record is FamilyRecord => record.tag === 'FAM');
      expect(fam?.marriageBeginningStatus).toBe('Friends');
      expect(fam?.marriageEndingStatus).toBe('Widowed');
      const output = ser(dataset);
      expect(lines(output)).toContain('1 _MSTAT Friends');
      expect(lines(output)).toContain('1 _MEND Widowed');
      expect(parseOk(output)).toEqual(dataset);
    }
  });

  test('a repeated _MSTAT is a cardinality error', () => {
    const result = parseGedcom551(enc(fam551(['1 _MSTAT Friends', '1 _MSTAT Engaged'])));
    if (result.ok) {
      throw new Error('expected a duplicate _MSTAT to fail');
    }
    expect(result.error.code).toBe('structure.cardinality');
  });
});

describe('the RootsMagic _SUBQ under a source citation', () => {
  test('parses and round-trips in both versions', () => {
    for (const parseOk of [parseOk551, parseOk70]) {
      const sample = parseOk === parseOk551 ? indi551 : indi70;
      const ser = parseOk === parseOk551 ? ser551 : ser70;
      const dataset = parseOk(sample(['1 BIRT', '2 SOUR @S2@', '3 _SUBQ 2nd cit.', '0 @S2@ SOUR', '1 TITL Book']));
      const indi = dataset.records.find((record): record is IndividualRecord => record.tag === 'INDI');
      const citation = (indi as IndividualRecord).events?.[0]?.detail?.citations?.[0];
      expect(citation?.subsequentCitationFormat).toBe('2nd cit.');
      const output = ser(dataset);
      expect(lines(output)).toContain('3 _SUBQ 2nd cit.');
      expect(parseOk(output)).toEqual(dataset);
    }
  });
});

describe('the RootsMagic _SENT/_PPFX under event details', () => {
  test('parses the underscore and 5.x non-underscore spellings', () => {
    const dataset = parseOk551(
      indi551(['1 BIRT', '2 DATE 1900', '2 _SENT [person] was born', '2 SENT second', '2 _PPFX in', '2 PPFX near']),
    );
    const indi = dataset.records.find((record): record is IndividualRecord => record.tag === 'INDI');
    const detail = (indi as IndividualRecord).events?.[0]?.detail;
    // The last spelling wins (both map onto the same field).
    expect(detail?.sentence).toBe('second');
    expect(detail?.placePrefix).toBe('near');
  });

  test('writes back the canonical underscore spelling in both versions', () => {
    const dataset = parseOk551(indi551(['1 BIRT', '2 SENT [person] was born', '2 PPFX in']));
    const text551 = ser551(dataset);
    expect(lines(text551)).toContain('2 _SENT [person] was born');
    expect(lines(text551)).toContain('2 _PPFX in');
    expect(text551).not.toContain('2 SENT');
    expect(parseOk551(text551)).toEqual(dataset);
    const text70 = ser70(dataset);
    expect(lines(text70)).toContain('2 _SENT [person] was born');
    expect(lines(text70)).toContain('2 _PPFX in');
  });

  test('7.0 input stays strict for the non-underscore spellings', () => {
    for (const tag of ['SENT', 'PPFX']) {
      const result = parseGedcom70(enc(indi70(['1 BIRT', `2 ${tag} x`])));
      if (result.ok) {
        throw new Error(`expected ${tag} to fail on 7.0 input`);
      }
      expect(result.error.code, tag).toBe('structure.unknown-tag');
    }
  });
});

describe('the Legacy _EVENT_DEFN record', () => {
  const MEMBERS = [
    '1 _CONF_FLAG Y',
    '1 _DATE_TYPE YES',
    '1 _DESC_FLAG NO',
    '1 _PLACE_TYPE YES',
    '1 _PP_EXCLUDE YES',
    '1 _SEN1 first sentence',
    '1 _SEN3 third sentence',
    '1 _SENM He was',
    '1 _SENF She was',
    '1 _SENU They were',
    '1 _SENDOM He was on [D]',
    '1 _SENPOM He was in [P]',
    '1 _SENDPM He was on [D] in [P]',
    '1 _SENDOF She was on [D]',
    '1 _SENPOF She was in [P]',
    '1 _SENDPF She was on [D] in [P]',
    '1 _SENDOU They were on [D]',
    '1 _SENPOU They were in [P]',
    '1 _SENDPU They were on [D] in [P]',
  ];

  const EXPECTED = (eventType: string | undefined): object => ({
    tag: '_EVENT_DEFN',
    ...(eventType === undefined ? {} : { eventType }),
    confidentialFlag: true,
    dateType: 'YES',
    descriptionFlag: 'NO',
    placeType: 'YES',
    potentialProblemsExcluded: 'YES',
    sentences: ['first sentence', '', 'third sentence'],
    pafSentences: {
      male: 'He was',
      female: 'She was',
      unknown: 'They were',
      maleDateOnly: 'He was on [D]',
      malePlaceOnly: 'He was in [P]',
      maleDateAndPlace: 'He was on [D] in [P]',
      femaleDateOnly: 'She was on [D]',
      femalePlaceOnly: 'She was in [P]',
      femaleDateAndPlace: 'She was on [D] in [P]',
      unknownDateOnly: 'They were on [D]',
      unknownPlaceOnly: 'They were in [P]',
      unknownDateAndPlace: 'They were on [D] in [P]',
    },
  });

  test('parses the payload, standard-tag and TYPE keying forms', () => {
    const payloadForm = parseOk551([...H551, '0 _EVENT_DEFN BIRT', ...MEMBERS, ...SUBM, '0 TRLR'].join('\n'));
    const record = payloadForm.records.find((entry): entry is EventDefinitionRecord => entry.tag === '_EVENT_DEFN');
    expect(record).toEqual(EXPECTED('BIRT'));

    const childForm = parseOk551([...H551, '0 _EVENT_DEFN', '1 BIRT', ...MEMBERS, ...SUBM, '0 TRLR'].join('\n'));
    expect(childForm.records.find((entry) => entry.tag === '_EVENT_DEFN')).toEqual(EXPECTED('BIRT'));

    const typeForm = parseOk551([...H551, '0 _EVENT_DEFN', '1 _TYPE BIRT', ...MEMBERS, ...SUBM, '0 TRLR'].join('\n'));
    expect(typeForm.records.find((entry) => entry.tag === '_EVENT_DEFN')).toEqual(EXPECTED('BIRT'));
  });

  test('round-trips in both versions with the payload keying', () => {
    const dataset = parseOk551([...H551, '0 _EVENT_DEFN BIRT', ...MEMBERS, ...SUBM, '0 TRLR'].join('\n'));
    const output551 = ser551(dataset);
    expect(lines(output551)).toContain('0 _EVENT_DEFN BIRT');
    expect(lines(output551)).toContain('1 _CONF_FLAG Y');
    expect(lines(output551)).toContain('1 _SEN1 first sentence');
    expect(lines(output551)).toContain('1 _SEN3 third sentence');
    expect(lines(output551)).not.toContain('1 _SEN2');
    expect(lines(output551)).toContain('1 _SENM He was');
    expect(lines(output551)).toContain('1 _SENDPU They were on [D] in [P]');
    expect(parseOk551(output551)).toEqual(dataset);

    // The same record parsed and round-tripped as 7.0.
    const dataset70 = parseOk70([...H70, '0 _EVENT_DEFN BIRT', ...MEMBERS, '0 TRLR'].join('\n'));
    const output70 = ser70(dataset70);
    expect(lines(output70)).toContain('0 _EVENT_DEFN BIRT');
    expect(lines(output70)).toContain('1 _CONF_FLAG Y');
    expect(lines(output70)).toContain('1 _SENDPU They were on [D] in [P]');
    expect(parseOk70(output70)).toEqual(dataset70);
  });

  test('keeps unknown underscore tags generic and rejects unknown standard tags', () => {
    const dataset = parseOk551([...H551, '0 _EVENT_DEFN BIRT', '1 _FOO note', ...SUBM, '0 TRLR'].join('\n'));
    const record = dataset.records.find((entry): entry is EventDefinitionRecord => entry.tag === '_EVENT_DEFN');
    expect(record?.extensions).toEqual([{ tag: '_FOO', payload: 'note', children: [] }]);
    const bad = parseGedcom551(enc([...H551, '0 _EVENT_DEFN BIRT', '1 BOGUS x', ...SUBM, '0 TRLR'].join('\n')));
    if (bad.ok) {
      throw new Error('expected BOGUS under _EVENT_DEFN to fail');
    }
    expect(bad.error.code).toBe('structure.unknown-tag');
  });

  test('two event-type keys are a cardinality error', () => {
    const result = parseGedcom551(enc([...H551, '0 _EVENT_DEFN BIRT', '1 MARR', ...SUBM, '0 TRLR'].join('\n')));
    if (result.ok) {
      throw new Error('expected two event types to fail');
    }
    expect(result.error.code).toBe('structure.cardinality');
  });

  test('an _EVENT_DEFN with an xref keeps it', () => {
    const dataset = parseOk551([...H551, '0 @E1@ _EVENT_DEFN BIRT', ...SUBM, '0 TRLR'].join('\n'));
    const record = dataset.records.find((entry): entry is EventDefinitionRecord => entry.tag === '_EVENT_DEFN');
    expect(record?.xref).toBe('@E1@');
    expect(lines(ser551(dataset))).toContain('0 @E1@ _EVENT_DEFN BIRT');
  });
});

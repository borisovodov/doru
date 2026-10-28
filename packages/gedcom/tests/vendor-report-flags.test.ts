import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parse70(text: string): GedcomDataset {
  const result = parseGedcom70(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function parse551(text: string): GedcomDataset {
  const result = parseGedcom551(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function err551(text: string): string {
  const result = parseGedcom551(enc(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
}

function ser70(dataset: GedcomDataset): string {
  const result = serializeGedcom70(dataset);
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

const H551 = [
  '0 HEAD',
  '1 SOUR PAF',
  '1 SUBM @S1@',
  '1 GEDC',
  '2 VERS 5.5.1',
  '2 FORM LINEAGE-LINKED',
  '1 CHAR UTF-8',
  '0 @S1@ SUBM',
  '1 NAME Tester',
];

describe('Legacy report-formatting flags', () => {
  test('types _ITALIC/_PAREN/_QUOTED under SOUR (both Y and YES spellings)', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @S2@ SOUR',
        '1 TITL A Title',
        '1 PUBL Published',
        '1 _ITALIC Y',
        '1 _PAREN',
        '1 _QUOTED YES',
        '0 TRLR',
      ].join('\n'),
    );
    const sour = dataset.records.find((record) => record.tag === 'SOUR') as {
      titleItalic?: boolean; publicationParenthesized?: boolean; titleQuoted?: boolean;
    };
    expect(sour.titleItalic).toBe(true);
    expect(sour.publicationParenthesized).toBe(true);
    expect(sour.titleQuoted).toBe(true);

    const cleared = parse551(
      [
        ...H551,
        '0 @S2@ SOUR',
        '1 _ITALIC N',
        '1 _PAREN NO',
        '1 _QUOTED N',
        '0 TRLR',
      ].join('\n'),
    );
    const sour2 = cleared.records.find((record) => record.tag === 'SOUR') as {
      titleItalic?: boolean; publicationParenthesized?: boolean; titleQuoted?: boolean;
    };
    expect(sour2.titleItalic).toBe(false);
    expect(sour2.publicationParenthesized).toBe(false);
    expect(sour2.titleQuoted).toBe(false);
  });

  test('rejects an invalid flag value', () => {
    expect(err551([...H551, '0 @S2@ SOUR', '1 _ITALIC MAYBE', '0 TRLR'].join('\n'))).toBe('enum.invalid-value');
  });

  test('writes the flags back in both versions', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @S2@ SOUR',
        '1 TITL A Title',
        '1 _ITALIC Y',
        '1 _PAREN Y',
        '1 _QUOTED Y',
        '0 TRLR',
      ].join('\n'),
    );
    expect(ser551(dataset)).toContain('1 _ITALIC Y');
    expect(ser551(dataset)).toContain('1 _PAREN Y');
    expect(ser551(dataset)).toContain('1 _QUOTED Y');
    expect(ser70(dataset)).toContain('1 _ITALIC Y');
    expect(ser70(dataset)).toContain('1 _QUOTED Y');
  });

  test('types _SORT and _LIST1–_LIST6 under ADDR and writes them back', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '1 RESI',
        '2 ADDR 1 Main St',
        '3 _SORT Doe, John',
        '3 _LIST1 YES',
        '3 _LIST2 YES',
        '3 _LIST3 N',
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records.find((record) => record.tag === 'INDI') as {
      attributes?: Array<{ detail?: { address?: Record<string, unknown> } }>;
    };
    const addr = indi.attributes?.[0]?.detail?.address as {
      sortName?: string;
      newsletterList?: boolean;
      familyAssociationList?: boolean;
      birthdayList?: boolean;
    };
    expect(addr?.sortName).toBe('Doe, John');
    expect(addr?.newsletterList).toBe(true);
    expect(addr?.familyAssociationList).toBe(true);
    expect(addr?.birthdayList).toBe(false);
  });

  test('_SORT/_LIST survive an address round trip', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @R1@ REPO',
        '1 NAME Repo',
        '1 ADDR 1 Main St',
        '2 _SORT Repo Name',
        '2 _LIST4 YES',
        '2 _LIST6 YES',
        '0 TRLR',
      ].join('\n'),
    );
    const out70 = ser70(dataset);
    expect(out70).toContain('2 _SORT Repo Name');
    expect(out70).toContain('2 _LIST4 YES');
    expect(out70).toContain('2 _LIST6 YES');
    const out551 = ser551(dataset);
    expect(out551).toContain('2 _SORT Repo Name');
    expect(out551).toContain('2 _LIST4 YES');
    expect(out551).toContain('2 _LIST6 YES');
  });

  test('types Legacy _OVER as the event sentence (written back as _SENT)', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @F1@ FAM',
        '1 MARR',
        '2 DATE 1900',
        '2 _OVER Married in haste',
        '0 TRLR',
      ].join('\n'),
    );
    const fam = dataset.records.find((record) => record.tag === 'FAM') as {
      events?: Array<{ detail?: { detail?: { sentence?: string } } }>;
    };
    expect(fam.events?.[0]?.detail?.detail?.sentence).toBe('Married in haste');
    expect(ser551(dataset)).toContain('2 _SENT Married in haste');
  });

  test('types Legacy _PREP on a _PLAC_DEFN record and keeps it on both outputs', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @P1@ _PLAC_DEFN',
        '1 PLAC Paris',
        '1 ABBR PAR',
        '1 _PREP in',
        '0 TRLR',
      ].join('\n'),
    );
    const card = dataset.records.find((record) => record.tag === '_PLAC') as { tag: string; preposition?: string };
    expect(card.tag).toBe('_PLAC');
    expect(card.preposition).toBe('in');
    // The preposition forces the card's survival as a _LOC record.
    expect(ser551(dataset)).toContain('1 _PREP in');
    expect(ser70(dataset)).toContain('1 _PREP in');
  });

  test('types PAF5 _MEDC as a FACT with TYPE "Medical condition"', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '1 _MEDC Asthma',
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records.find((record) => record.tag === 'INDI') as {
      attributes?: Array<{ tag: string; payload?: string; type?: string }>;
    };
    expect(indi.attributes?.[0]).toEqual({ tag: 'FACT', payload: 'Asthma', type: 'Medical condition' });
    expect(ser551(dataset)).toContain('1 FACT Asthma');
    expect(ser551(dataset)).toContain('2 TYPE Medical condition');
  });
});

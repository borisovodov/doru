import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parseGedcom70 } from '../src/parsing/assemble';
import { parseGedzip } from '../src/gedzip';
import { serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset } from '../src/structures';

// The complete official FamilySearch GEDCOM 7.0 test-file corpus
// (fetched from https://gedcom.io/testfiles/gedcom70/; see the NOTICE
// in fixtures/gedcom70/ for the Apache-2.0 terms and the FamilySearch
// notice). Every .ged file must parse, and round-trip through the 7.0
// serializer model-stably and idempotently; the .gdz files are GEDZIP
// archives and must parse as such.

import ageGed from './fixtures/gedcom70/age.ged?raw';
import dateGed from './fixtures/gedcom70/date.ged?raw';
import escapesGed from './fixtures/gedcom70/escapes.ged?raw';
import extensionRecordGed from './fixtures/gedcom70/extension-record.ged?raw';
import extensionsGed from './fixtures/gedcom70/extensions.ged?raw';
import filename1Ged from './fixtures/gedcom70/filename-1.ged?raw';
import langGed from './fixtures/gedcom70/lang.ged?raw';
import longUrlGed from './fixtures/gedcom70/long-url.ged?raw';
import maximal70LdsGed from './fixtures/gedcom70/maximal70-lds.ged?raw';
import maximal70Memories1Ged from './fixtures/gedcom70/maximal70-memories1.ged?raw';
import maximal70Memories2Ged from './fixtures/gedcom70/maximal70-memories2.ged?raw';
import maximal70Tree1Ged from './fixtures/gedcom70/maximal70-tree1.ged?raw';
import maximal70Tree2Ged from './fixtures/gedcom70/maximal70-tree2.ged?raw';
import maximal70Ged from './fixtures/gedcom70/maximal70.ged?raw';
import minimal70Ged from './fixtures/gedcom70/minimal70.ged?raw';
import notes1Ged from './fixtures/gedcom70/notes-1.ged?raw';
import obje1Ged from './fixtures/gedcom70/obje-1.ged?raw';
import remarriage1Ged from './fixtures/gedcom70/remarriage1.ged?raw';
import remarriage2Ged from './fixtures/gedcom70/remarriage2.ged?raw';
import sameSexMarriageGed from './fixtures/gedcom70/same-sex-marriage.ged?raw';
import voidptrGed from './fixtures/gedcom70/voidptr.ged?raw';
import warnings70Ged from './fixtures/gedcom70/warnings70.ged?raw';
import xrefGed from './fixtures/gedcom70/xref.ged?raw';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

const GED_FILES: ReadonlyArray<readonly [string, string]> = [
  ['age.ged', ageGed],
  ['date.ged', dateGed],
  ['escapes.ged', escapesGed],
  ['extension-record.ged', extensionRecordGed],
  ['extensions.ged', extensionsGed],
  ['filename-1.ged', filename1Ged],
  ['lang.ged', langGed],
  ['long-url.ged', longUrlGed],
  ['maximal70-lds.ged', maximal70LdsGed],
  ['maximal70-memories1.ged', maximal70Memories1Ged],
  ['maximal70-memories2.ged', maximal70Memories2Ged],
  ['maximal70-tree1.ged', maximal70Tree1Ged],
  ['maximal70-tree2.ged', maximal70Tree2Ged],
  ['maximal70.ged', maximal70Ged],
  ['minimal70.ged', minimal70Ged],
  ['notes-1.ged', notes1Ged],
  ['obje-1.ged', obje1Ged],
  ['remarriage1.ged', remarriage1Ged],
  ['remarriage2.ged', remarriage2Ged],
  ['same-sex-marriage.ged', sameSexMarriageGed],
  ['voidptr.ged', voidptrGed],
  ['warnings70.ged', warnings70Ged],
  ['xref.ged', xrefGed],
];

function parseOk70(text: string): GedcomDataset {
  const result = parseGedcom70(enc(text));
  if (!result.ok) {
    throw new Error(`${JSON.stringify(result.error)}`);
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

describe('the complete official FamilySearch GEDCOM 7.0 test corpus (gedcom.io/testfiles/gedcom70/)', () => {
  for (const [name, text] of GED_FILES) {
    test(`${name} parses and round-trips model-stably and idempotently`, () => {
      const first = parseOk70(text);
      const serialized = ser70(first);
      expect(parseOk70(serialized)).toEqual(first);
      expect(ser70(parseOk70(serialized))).toBe(serialized);
    });
  }

  test('the GEDZIP archives parse', () => {
    for (const name of ['maximal70.gdz', 'minimal70.gdz']) {
      const bytes = readFileSync(new URL(`./fixtures/gedcom70/${name}`, import.meta.url));
      const result = parseGedzip(bytes);
      if (!result.ok) {
        throw new Error(`${name}: ${JSON.stringify(result.error)}`);
      }
    }
  });
});

import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import type { GedcomDataset } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parseOk(result: { ok: true; value: GedcomDataset } | { ok: false; error: unknown }): GedcomDataset {
  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }
  return result.value;
}

/** Strips the declared version — the one field the invariant allows to
 *  differ. */
function stripVersion(dataset: GedcomDataset): GedcomDataset {
  const copy = structuredClone(dataset);
  delete (copy.header.gedcom as { version?: string }).version;
  return copy;
}

/**
 * The import-grammar invariant: the declared GEDC.VERS selects no
 * grammar, so identical bytes must parse into identical models — apart
 * from the stored version string itself (see the README's Known strict
 * decisions). The document below exercises the forms where the two
 * grammars historically differed: 5.5.1 dates (INT, B.C., calendar
 * escapes), a 7.0 calendar keyword, vendor tags, a free-text citation,
 * a NOTE pointer, contacts beside an ADDR, a 5.5.5 SEX value, and a
 * Gramps-style ASSO.
 */
const BODY = [
  '1 SOUR My App',
  '1 SUBM @S1@',
  '1 GEDC',
  '2 VERS %VERS%',
  '2 FORM LINEAGE-LINKED',
  '1 CHAR UTF-8',
  '0 @S1@ SUBM',
  '1 NAME Tester',
  '1 ADDR Main St',
  '2 PHON +49 1',
  '0 @N1@ NOTE Shared note',
  '0 @S2@ SOUR',
  '1 TITL A Book',
  '0 @I1@ INDI',
  '1 NAME John /Doe/',
  '2 GIVN John, Jonathan',
  '2 TYPE aka',
  '1 SEX X',
  '1 BIRT',
  '2 DATE INT 1 JAN 1900 (computed)',
  '2 PLAC Rome',
  '2 ADDR Via Appia',
  '3 PHON +39 06 123',
  '1 DEAT',
  '2 DATE @#DJULIAN@ 5 OCT 1582',
  '1 BURI',
  '2 DATE 44 B.C.',
  '1 NOTE @N1@',
  '1 SOUR free text citation',
  '1 ASSO @I2@',
  '2 RELA Godfather',
  '1 FACT tall',
  '2 TYPE Height',
  '1 _SOSA 42',
  '0 @I2@ INDI',
  '1 NAME Jane /Doe/',
  '1 BIRT',
  '2 DATE GREGORIAN 1 JAN 1900 BCE',
  '0 TRLR',
];

function doc(version: string): string {
  return `0 HEAD\n${BODY.map((line) => line.replace('%VERS%', version)).join('\n')}\n`;
}

describe('the import-grammar invariant', () => {
  test('identical bytes with different VERS declarations parse into the same model', () => {
    const as551 = parseOk(parseGedcom551(enc(doc('5.5.1'))));
    const as70 = parseOk(parseGedcom70(enc(doc('7.0'))));
    expect(stripVersion(as551)).toEqual(stripVersion(as70));
  });

  test('the same file parses the same way through either entry point', () => {
    const as551 = parseOk(parseGedcom551(enc(doc('5.5.1'))));
    const as551Via70 = parseOk(parseGedcom70(enc(doc('5.5.1'))));
    expect(as551Via70).toEqual(as551);
  });
});

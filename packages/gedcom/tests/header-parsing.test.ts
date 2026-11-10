import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import type { GedcomDataset } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parseOk70(text: string | string[]): GedcomDataset {
  const source = Array.isArray(text) ? text.join('\n') : text;
  const result = parseGedcom70(enc(source));
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

function parseOk551(text: string | string[]): GedcomDataset {
  const source = Array.isArray(text) ? text.join('\n') : text;
  const result = parseGedcom551(enc(source));
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

function parseFail70(text: string): string {
  const result = parseGedcom70(enc(text));
  if (result.ok) {
    throw new Error('expected a parse failure');
  }
  return result.error.message;
}

describe('header structure vendor fields', () => {
  test('parses the 7.0 header vendor fields', () => {
    const dataset = parseOk70([
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 WWW https://doru.example',
      '1 NOTE first note',
      '1 NOTE second note (dropped)',
      '1 _HME @I1@',
      '1 _NAVM 2',
      '1 _STATS',
      '2 INDI 3',
      '2 FAM 1',
      '2 REPO 2',
      '2 SOUR 4',
      '2 NOTE 5',
      '2 SUBM 1',
      '2 OBJE 6',
      '2 _TASK 7',
      '1 SCHMA',
      '2 TAG _FOO https://example.org/foo',
      '2 PRFX foo https://example.org/foo#',
      '2 IRI https://example.org/x#',
      '3 TAG x',
      '3 ISA y',
      '3 LANG en',
      '1 SUBM @U1@',
      '0 @U1@ SUBM',
      '0 @I1@ INDI',
      '0 TRLR',
    ]);
    const header = dataset.header;
    expect(header).toMatchObject({
      www: ['https://doru.example'],
      note: expect.objectContaining({ payload: 'first note' }),
      startPerson: '@I1@',
      startPersonMode: '2',
      schema: {
        prefixes: [{ tag: 'PRFX', prefix: 'foo', uri: 'https://example.org/foo#' }],
        elfDefinitions: [
          { tag: 'IRI', iri: 'https://example.org/x#', tagValues: ['x'], parents: ['y'], language: 'en' },
        ],
      },
    });
  });

  test('rejects an invalid _NAVM value', () => {
    expect(parseFail70(['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 _NAVM 9', '1 SUBM @U1@', '0 @U1@ SUBM', '0 TRLR'].join('\n'))).toContain(
      'must be 0, 1 or 2',
    );
  });

  test('rejects a malformed PRFX declaration', () => {
    expect(
      parseFail70(['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 SCHMA', '2 PRFX broken', '1 SUBM @U1@', '0 @U1@ SUBM', '0 TRLR'].join('\n')),
    ).toContain('must be "<tag> <uri>"');
  });

  test('parses the 5.5.1 header schema blocks and stats', () => {
    const dataset = parseOk551([
      '0 HEAD',
      '1 SOUR TEST',
      '1 SUBM @S1@',
      '1 GEDC',
      '2 VERS 5.5.1',
      '2 FORM LINEAGE-LINKED',
      '1 CHAR UTF-8',
      '1 _NAVI @I1@',
      '1 _STATS',
      '2 INDI 1',
      '2 FAM 1',
      '1 SCHEMA',
      '2 INDI',
      '3 _FA1',
      '4 LABL Fact 1',
      '1 SCHEMA',
      '2 INDI',
      '3 _FA2',
      '4 LABL Fact 2',
      '0 @S1@ SUBM',
      '1 NAME T',
      '0 @I1@ INDI',
      '0 TRLR',
    ]);
    const header = dataset.header;
    expect(header).toMatchObject({
      startPerson: '@I1@',
      schema53: expect.anything(),
    });
    // The second SCHEMA block is dropped (first occurrence wins).
    expect(header.schema53?.entries).toHaveLength(1);
    expect(header.schema53?.entries[0]).toMatchObject({ context: ['INDI', '_FA1'], label: 'Fact 1' });
  });

  test('parses the _SCHEMA vendor spelling with duplicates and definitions', () => {
    const dataset = parseOk551([
      '0 HEAD',
      '1 SOUR TEST',
      '1 SUBM @S1@',
      '1 GEDC',
      '2 VERS 5.5.1',
      '2 FORM LINEAGE-LINKED',
      '1 CHAR UTF-8',
      '1 _SCHEMA',
      '2 INDI',
      '3 _FA1',
      '4 LABL first',
      '4 LABL second (dropped)',
      '4 DEFN first def',
      '4 DEFN second (dropped)',
      '4 _DEFN third (dropped)',
      '4 ISA Parent Name',
      '5 _XTRN odd',
      '4 ISA second parent (dropped)',
      '0 @S1@ SUBM',
      '1 NAME T',
      '0 @I1@ INDI',
      '0 TRLR',
    ]);
    const header = dataset.header;
    const entry = header.schema53?.entries[0];
    expect(entry).toMatchObject({
      context: ['INDI', '_FA1'],
      label: 'first',
      definition: 'first def',
      parent: 'Parent Name',
      extensions: expect.arrayContaining([expect.objectContaining({ tag: '_XTRN' })]),
    });
  });

  test('rejects an unknown 5.5.1 charset', () => {
    const result = parseGedcom551(
      enc(['0 HEAD', '1 SOUR T', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR KATAKANA', '0 @S1@ SUBM', '0 TRLR'].join('\n')),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Unknown character set');
    }
  });
});

import { describe, expect, test } from 'vitest';
import { parseGedcom70 } from '../src/parsing/assemble';
import type { GedcomDataset } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parseOk(text: string | string[]): GedcomDataset {
  const source = Array.isArray(text) ? text.join('\n') : text;
  const result = parseGedcom70(enc(source));
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

describe('source-side vendor tags', () => {
  test('parses repository vendor fields', () => {
    const dataset = parseOk([
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 SUBM @U1@',
      '0 @U1@ SUBM',
      '0 @R1@ REPO',
      '1 NAME State Archive',
      '1 _TAG @T1@',
      '1 _TAG not a pointer',
      '1 _SUBM @U1@',
      '1 _IMPF imp-1',
      '1 CREA not a date',
      '1 PHON 123',
      '1 EMAIL a@b.c',
      '1 FAX 456',
      '1 WWW https://r.example',
      '1 REFN ref-1',
      '0 @T1@ _TAG',
      '1 NAME favorites',
      '0 TRLR',
    ]);
    const repo = dataset.records.find((entry) => entry.tag === 'REPO');
    expect(repo).toMatchObject({
      name: 'State Archive',
      tagLinks: [{ tag: '_TAG', target: '@T1@' }],
      submitters: ['@U1@'],
      importReference: expect.anything(),
      phone: ['123'],
      email: ['a@b.c'],
      fax: ['456'],
      www: ['https://r.example'],
      identifiers: [{ payload: 'ref-1' }],
      extensions: expect.arrayContaining([expect.objectContaining({ tag: '_TAG', payload: 'not a pointer' })]),
    });
  });

  test('parses shared-note vendor fields', () => {
    const dataset = parseOk([
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 SUBM @U1@',
      '0 @U1@ SUBM',
      '0 @N1@ SNOTE shared text',
      '1 _TAG @T1@',
      '1 _TAG not a pointer',
      '1 CREA not a date',
      '1 _SUBM @U1@',
      '1 _IMPF imp-2',
      '1 REFN ref-2',
      '1 UID uid-2',
      '1 EXID exid-2',
      '0 @T1@ _TAG',
      '1 NAME favorites',
      '0 TRLR',
    ]);
    const note = dataset.records.find((entry) => entry.tag === 'SNOTE');
    expect(note).toMatchObject({
      payload: 'shared text',
      tagLinks: [{ tag: '_TAG', target: '@T1@' }],
      submitters: ['@U1@'],
      importReference: expect.anything(),
      identifiers: expect.arrayContaining([expect.objectContaining({ payload: 'ref-2' })]),
      extensions: expect.arrayContaining([expect.objectContaining({ tag: '_TAG', payload: 'not a pointer' })]),
    });
  });

  test('parses inline note vendor fields', () => {
    const dataset = parseOk([
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 SUBM @U1@',
      '0 @U1@ SUBM',
      '0 @I1@ INDI',
      '1 NOTE a note',
      '2 _TAG not a pointer',
      '2 CREA not a date',
      '2 _CRE',
      '3 DATE 2026',
      '2 _SUBM @U1@',
      '2 _IMPF imp-3',
      '0 TRLR',
    ]);
    const individual = dataset.records.find((entry) => entry.tag === 'INDI');
    expect(individual).toMatchObject({
      notes: [
        {
          payload: 'a note',
          extensions: expect.arrayContaining([
            expect.objectContaining({ tag: '_TAG', payload: 'not a pointer' }),
            expect.objectContaining({ tag: '_SUBM', payload: '@U1@' }),
            expect.objectContaining({ tag: '_IMPF', payload: 'imp-3' }),
            expect.objectContaining({ tag: '_CRE' }),
          ]),
        },
      ],
    });
  });

  test('parses source vendor fields and report flags', () => {
    const dataset = parseOk([
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 SUBM @U1@',
      '0 @U1@ SUBM',
      '0 @S1@ SOUR',
      '1 TITL The Book',
      '2 NOTE a note on the title',
      '1 ABBR TB',
      '2 NOTE a note on the abbreviation',
      '1 _TAG YES',
      '1 _TAG',
      '1 _TAG2',
      '1 _TAG3 Y',
      '1 _TAG4',
      '1 CREA not a date',
      '1 _CRE',
      '2 DATE 2026',
      '0 TRLR',
    ]);
    const source = dataset.records.find((entry) => entry.tag === 'SOUR');
    expect(source).toMatchObject({
      title: 'The Book',
      titleExtensions: expect.arrayContaining([expect.objectContaining({ tag: 'NOTE' })]),
      abbreviation: 'TB',
      abbreviationExtensions: expect.arrayContaining([expect.objectContaining({ tag: 'NOTE' })]),
      citationDetailIncluded: true,
      citationDetailTextIncluded: true,
      creationDate: expect.anything(),
    });
    expect(source).toHaveProperty('extensions');
  });
});

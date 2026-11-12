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

const HEADER = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 SUBM @U1@', '0 @U1@ SUBM', '0 TRLR'];

describe('evidence records and links', () => {
  test('parses an _EVID record with every child', () => {
    const dataset = parseOk([
      ...HEADER.slice(0, 5),
      '0 @E1@ _EVID',
      '1 _TYPE birth certificate',
      '1 _DTYPE scan',
      '1 _ID eid-1',
      '1 _FIND born 1923',
      '2 TYPE birth date',
      '2 DATE 12 MAR 1923',
      '2 PLAC Moscow, Russia',
      '2 AGE < 1y 2m 3d',
      '3 PHRASE an infant',
      '2 NOTE see the scan',
      '2 _EVID @E2@',
      '1 _ANAL checked the original',
      '1 DATE 2026',
      '1 SOUR @S1@',
      '2 PAGE p. 5',
      '1 NOTE a note on the evidence',
      '1 SNOTE @N1@',
      '1 UID 550e8400',
      '1 _RDOC @D1@',
      '1 CHAN',
      '2 DATE 1 JAN 2026',
      '0 @E2@ _EVID',
      '0 @S1@ SOUR',
      '1 TITL The Book',
      '0 @N1@ SNOTE a shared note',
      '0 @D1@ _RDOC',
      '0 TRLR',
    ]);
    const record = dataset.records.find((entry) => entry.tag === '_EVID');
    expect(record).toBeDefined();
    expect(record).toMatchObject({
      xref: '@E1@',
      type: 'birth certificate',
      documentType: 'scan',
      identifiers: ['eid-1'],
      analysis: ['checked the original'],
      uids: ['550e8400'],
    });
  });

  test('parses research documents with conclusions', () => {
    const dataset = parseOk([
      ...HEADER.slice(0, 5),
      '0 @D1@ _RDOC',
      '1 _TITL Petrov notes',
      '1 _TEXT Some notes.',
      '1 _SUBJ @I1@',
      '1 _EVID @E1@',
      '1 _CONC',
      '2 _SUBJ @I1@',
      '2 _TEXT Born in 1923.',
      '1 AUTH Ivan',
      '1 DATE 2025',
      '1 NOTE a note',
      '1 CHAN',
      '2 DATE 1 JAN 2026',
      '0 @I1@ INDI',
      '0 @E1@ _EVID',
      '0 TRLR',
    ]);
    const record = dataset.records.find((entry) => entry.tag === '_RDOC');
    expect(record).toMatchObject({
      xref: '@D1@',
      title: 'Petrov notes',
      text: 'Some notes.',
      subjects: ['@I1@'],
      evidence: ['@E1@'],
      author: 'Ivan',
      conclusions: [{ tag: '_CONC', subject: '@I1@', text: 'Born in 1923.' }],
    });
  });

  test('parses research activities with findings', () => {
    const dataset = parseOk([
      ...HEADER.slice(0, 5),
      '0 @A1@ _RACT',
      '1 _TYPE visit',
      '1 _PURP check the archive',
      '1 _TARG P1',
      '1 _VENU State Archive',
      '1 _RSLT found the entry',
      '1 _FIND the entry',
      '2 TYPE record',
      '1 DATE 2025',
      '1 _RSRCH Ivan',
      '1 NOTE a note',
      '1 CHAN',
      '2 DATE 1 JAN 2026',
      '0 TRLR',
    ]);
    const record = dataset.records.find((entry) => entry.tag === '_RACT');
    expect(record).toMatchObject({
      xref: '@A1@',
      type: 'visit',
      purpose: 'check the archive',
      target: 'P1',
      venue: 'State Archive',
      result: 'found the entry',
      researcher: 'Ivan',
    });
  });

  test('parses _TAG records with attributes and _TAG links', () => {
    const dataset = parseOk([
      ...HEADER.slice(0, 5),
      '0 @T1@ _TAG',
      '1 NAME favorites',
      '1 _COLOR red',
      '1 _ATTR key',
      '2 _VALUE val',
      '2 NOTE a note',
      '0 @I1@ INDI',
      '1 NAME Ivan /Petrov/',
      '1 _TAG @T1@',
      '2 DATE 2026',
      '2 NOTE linked in 2026',
      '0 TRLR',
    ]);
    const tag = dataset.records.find((entry) => entry.tag === '_TAG');
    expect(tag).toMatchObject({
      xref: '@T1@',
      name: 'favorites',
      color: 'red',
      attributes: [{ tag: '_ATTR', payload: 'key', value: 'val' }],
    });
    const individual = dataset.records.find((entry) => entry.tag === 'INDI');
    expect(individual).toMatchObject({ tagLinks: [{ tag: '_TAG', target: '@T1@' }] });
  });

  test('parses _EVEN_EVID evidence events under INDI', () => {
    const dataset = parseOk([
      ...HEADER.slice(0, 5),
      '0 @I1@ INDI',
      '1 NAME Ivan /Petrov/',
      '1 _EVEN_EVID',
      '2 TYPE birth',
      '2 DATE 12 MAR 1923',
      '2 SOUR @S1@',
      '2 _FIND born',
      '2 _CONF high',
      '2 NOTE a note',
      '0 @S1@ SOUR',
      '0 TRLR',
    ]);
    const individual = dataset.records.find((entry) => entry.tag === 'INDI');
    expect(individual).toMatchObject({
      evidenceEvents: [
        {
          tag: '_EVEN_EVID',
          type: 'birth',
          confidence: 'high',
        },
      ],
    });
  });

  test('parses _EVREF evidence references and _OCREF occurrence references', () => {
    const dataset = parseOk([
      ...HEADER.slice(0, 5),
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I2@',
      '1 _EVREF @E1@',
      '2 _CONF high',
      '2 _USED yes',
      '2 _RDOC @D1@',
      '2 QUAY 3',
      '2 NOTE a note',
      '2 SNOTE @N1@',
      '1 _OCREF @O1@',
      '2 ROLE witness',
      '2 AGE 34y',
      '2 NOTE a note',
      '2 SOUR @S1@',
      '2 _ATTR key',
      '3 _VALUE val',
      '0 @I1@ INDI',
      '0 @I2@ INDI',
      '0 @E1@ _EVID',
      '0 @O1@ _OCRC',
      '0 @D1@ _RDOC',
      '0 @N1@ SNOTE shared',
      '0 @S1@ SOUR',
      '0 TRLR',
    ]);
    const family = dataset.records.find((entry) => entry.tag === 'FAM');
    expect(family).toMatchObject({
      evidence: [
        { tag: '_EVREF', evidence: '@E1@', confidence: 'high', used: 'yes', documents: ['@D1@'], quality: '3' },
      ],
      occurrences: [
        {
          tag: '_OCREF',
          occurrence: '@O1@',
          role: 'witness',
          attributes: [{ tag: '_ATTR', payload: 'key', value: 'val' }],
        },
      ],
    });
  });
});

import { describe, expect, test } from 'vitest';
import { Writer } from '../src/serialize/writer';
import {
  emitChangeBlock,
  emitEvidenceEvent,
  emitEvidenceRecord,
  emitEvidenceReference,
  emitOccurrenceReference,
  emitResearchActivityRecord,
  emitResearchDocumentRecord,
  emitVendorAttribute,
} from '../src/serialize/emitter/evidence';
import { emitTagLink, emitTagRecord } from '../src/serialize/emitter/evidence';

const lines = (w: Writer): string[] => w.lines;

describe('evidence emitters', () => {
  test('emits a CHAN block with notes, citations and user', () => {
    const w = new Writer('7.0');
    emitChangeBlock(w, '7.0', 1, {
      tag: 'CHAN',
      date: { value: { day: 1, month: 'JAN', year: 2026 }, time: { hour: 12, minute: 0 } },
      notes: [{ tag: 'NOTE', payload: 'a note' }],
      citations: [{ tag: 'SOUR', source: '@S1@' }],
      user: 'ivan',
      extensions: [{ tag: '_X', payload: 'y', children: [] }],
    });
    expect(lines(w)).toEqual([
      '1 CHAN',
      '2 DATE 1 JAN 2026',
      '3 TIME 12:0',
      '2 NOTE a note',
      '2 SOUR @S1@',
      '2 _WT_USER ivan',
      '2 _X y',
    ]);
  });

  test('emits vendor attributes with value and notes', () => {
    const w = new Writer('7.0');
    emitVendorAttribute(w, '7.0', 2, {
      tag: '_ATTR',
      payload: 'key',
      value: 'val',
      notes: [{ tag: 'NOTE', payload: 'n' }],
    });
    expect(lines(w)).toEqual(['2 _ATTR key', '3 _VALUE val', '3 NOTE n']);
  });

  test('emits evidence references with documents and notes', () => {
    const w = new Writer('7.0');
    emitEvidenceReference(w, '7.0', 1, {
      tag: '_EVREF',
      evidence: '@E1@',
      confidence: 'high',
      used: 'yes',
      quality: '3',
      documents: ['@D1@'],
      notes: [{ tag: 'NOTE', payload: 'n' }],
    });
    expect(lines(w)).toEqual(['1 _EVREF @E1@', '2 _CONF high', '2 _USED yes', '2 QUAY 3', '2 _RDOC @D1@', '2 NOTE n']);
  });

  test('emits evidence events with dates, citations, findings, confidence and notes', () => {
    const w = new Writer('7.0');
    emitEvidenceEvent(w, '7.0', 1, {
      tag: '_EVEN_EVID',
      type: 'birth',
      date: { value: { kind: 'date', day: 12, month: 'MAR', year: 1923 } },
      citations: [{ tag: 'SOUR', source: '@S1@' }],
      findings: [{ tag: '_FIND', payload: 'born', evidence: ['@E2@'] }],
      confidence: 'high',
      notes: [{ tag: 'NOTE', payload: 'n' }],
    });
    expect(lines(w)).toEqual([
      '1 _EVEN_EVID',
      '2 TYPE birth',
      '2 DATE 12 MAR 1923',
      '2 SOUR @S1@',
      '2 _FIND born',
      '3 _EVID @E2@',
      '2 _CONF high',
      '2 NOTE n',
    ]);
  });

  test('emits occurrence references with role, age, notes, citations and attributes', () => {
    const w = new Writer('7.0');
    emitOccurrenceReference(w, '7.0', 1, {
      tag: '_OCREF',
      occurrence: '@O1@',
      role: 'witness',
      age: { payload: { years: 34 } },
      notes: [{ tag: 'NOTE', payload: 'n' }],
      citations: [{ tag: 'SOUR', source: '@S1@' }],
      attributes: [{ tag: '_ATTR', payload: 'key', value: 'val' }],
    });
    expect(lines(w)).toEqual([
      '1 _OCREF @O1@',
      '2 ROLE witness',
      '2 AGE 34y',
      '2 NOTE n',
      '2 SOUR @S1@',
      '2 _ATTR key',
      '3 _VALUE val',
    ]);
  });

  test('emits tag records and tag links with dates and notes', () => {
    const w = new Writer('7.0');
    emitTagRecord(w, '7.0', {
      tag: '_TAG',
      xref: '@T1@',
      name: 'favorites',
      color: 'red',
      attributes: [{ tag: '_ATTR', payload: 'k' }],
    });
    emitTagLink(w, '7.0', 1, {
      tag: '_TAG',
      target: '@T1@',
      date: { value: { kind: 'date', year: 2026 } },
      notes: [{ tag: 'NOTE', payload: 'n' }],
    });
    expect(lines(w)).toEqual([
      '0 @T1@ _TAG',
      '1 NAME favorites',
      '1 _COLOR red',
      '1 _ATTR k',
      '1 _TAG @T1@',
      '2 DATE 2026',
      '2 NOTE n',
    ]);
  });

  test('emits evidence records with every field', () => {
    const w = new Writer('7.0');
    emitEvidenceRecord(w, '7.0', {
      tag: '_EVID',
      xref: '@E1@',
      type: 'birth certificate',
      documentType: 'scan',
      identifiers: ['eid-1'],
      date: { value: { kind: 'date', year: 1923 } },
      citations: [{ tag: 'SOUR', source: '@S1@' }],
      findings: [{ tag: '_FIND', payload: 'born', type: 'birth', age: { payload: { years: 0 } } }],
      analysis: ['line one'],
      uids: ['uid-1'],
      documents: ['@D1@'],
      notes: [{ tag: 'NOTE', payload: 'n' }],
      changeDate: { tag: 'CHAN', date: { value: { day: 1, month: 'JAN', year: 2026 } } },
    });
    expect(lines(w)).toEqual([
      '0 @E1@ _EVID',
      '1 _TYPE birth certificate',
      '1 _DTYPE scan',
      '1 _ID eid-1',
      '1 DATE 1923',
      '1 SOUR @S1@',
      '1 _FIND born',
      '2 TYPE birth',
      '2 AGE 0y',
      '1 _ANAL line one',
      '1 UID uid-1',
      '1 _RDOC @D1@',
      '1 NOTE n',
      '1 CHAN',
      '2 DATE 1 JAN 2026',
    ]);
  });

  test('emits research documents and activities with findings', () => {
    const w = new Writer('7.0');
    emitResearchDocumentRecord(w, '7.0', {
      tag: '_RDOC',
      xref: '@D1@',
      title: 'Notes',
      text: 'Body',
      subjects: ['@I1@'],
      evidence: ['@E1@'],
      conclusions: [{ tag: '_CONC', subject: '@I1@', text: 'Born in 1923.' }],
      author: 'Ivan',
      date: { value: { kind: 'date', year: 2025 } },
      notes: [{ tag: 'NOTE', payload: 'n' }],
      changeDate: { tag: 'CHAN', date: { value: { day: 1, month: 'JAN', year: 2026 } } },
    });
    emitResearchActivityRecord(w, '7.0', {
      tag: '_RACT',
      type: 'visit',
      purpose: 'check',
      target: 'P1',
      venue: 'archive',
      result: 'found',
      findings: [{ tag: '_FIND', payload: 'f' }],
      date: { value: { kind: 'date', year: 2025 } },
      researcher: 'Ivan',
      notes: [{ tag: 'NOTE', payload: 'n' }],
      changeDate: { tag: 'CHAN', date: { value: { day: 1, month: 'JAN', year: 2026 } } },
    });
    expect(lines(w).join('|')).toContain(
      '0 @D1@ _RDOC|1 _TITL Notes|1 _TEXT Body|1 _SUBJ @I1@|1 _EVID @E1@|1 _CONC|2 _SUBJ @I1@|2 _TEXT Born in 1923.|1 AUTH Ivan|1 DATE 2025|1 NOTE n|1 CHAN',
    );
    expect(lines(w).join('|')).toContain(
      '0 _RACT|1 _TYPE visit|1 _PURP check|1 _TARG P1|1 _VENU archive|1 _RSLT found|1 _FIND f|1 DATE 2025|1 _RSRCH Ivan|1 NOTE n|1 CHAN',
    );
  });

  test('drops void references when targeting 5.5.1', () => {
    const w = new Writer('5.5.1');
    emitEvidenceReference(w, '5.5.1', 1, { tag: '_EVREF', evidence: '@VOID@' });
    emitOccurrenceReference(w, '5.5.1', 1, { tag: '_OCREF', occurrence: '@VOID@' });
    emitTagLink(w, '5.5.1', 1, { tag: '_TAG', target: '@VOID@' });
    expect(lines(w)).toEqual([]);
  });
});

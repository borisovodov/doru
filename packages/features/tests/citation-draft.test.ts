import { describe, expect, it } from 'vitest';
import type { CitationRecord } from '@doru/core';
import { emptyDate } from '../src/person/draft';
import { citationDraftToRecord, citationToDraft } from '../src/person/citationDraft';

const citation = (overrides: Partial<CitationRecord> = {}): CitationRecord => ({
  id: 'C1',
  sourceId: 'S1',
  targetType: 'person',
  targetId: 'P1',
  ...overrides,
});

describe('citationToDraft / citationDraftToRecord', () => {
  it('round-trips every field', () => {
    const stored: CitationRecord = {
      id: 'C1',
      sourceId: 'S1',
      targetType: 'person',
      targetId: 'P1',
      page: 'l. 14',
      quality: 'primary',
      description: 'entry about Ivan',
      confidence: 'high',
      event: 'BIRT',
      role: 'witness',
      phrase: 'the record states',
      www: 'https://example.org/14',
      date: { quality: 'exact', component: { year: 1923 } },
      texts: [{ id: 'T1', text: 'extract', mime: 'text/plain', language: 'ru' }],
      templateFields: [{ id: 'F1', name: 'church', value: 'Nativity' }],
    };
    const draft = citationToDraft(stored);
    expect(draft).toMatchObject({
      id: 'C1',
      sourceId: 'S1',
      targetType: 'person',
      targetId: 'P1',
      page: 'l. 14',
      quality: 'primary',
      description: 'entry about Ivan',
      confidence: 'high',
      event: 'BIRT',
      role: 'witness',
      phrase: 'the record states',
      www: 'https://example.org/14',
      date: { ...emptyDate(), year: '1923' },
    });
    expect(citationDraftToRecord(draft)).toEqual(stored);
  });

  it('drops empty optional fields and sub-rows', () => {
    const record = citationDraftToRecord({
      ...citationToDraft(citation()),
      page: '   ',
      texts: [{ id: 'T1', text: '  ', mime: '', language: '' }],
      templateFields: [{ id: 'F1', name: '  ', value: 'x' }],
    });
    expect(record.page).toBeUndefined();
    expect(record.texts).toEqual([]);
    expect(record.templateFields).toEqual([]);
  });
});

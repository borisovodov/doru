import { describe, expect, it } from 'vitest';
import type { CitationRecord } from '@doru/core';
import { emptyDate } from '../src/domain/person/draft';
import { citationDraftToRecord, citationToDraft } from '../src/domain/citation/citationDraft';

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
      name: 'entry 14',
      qualityAssessment: 'high',
      reference: 'CREF-1',
      abbreviation: 'MB23',
      footnote: 'see the metric book',
      verified: true,
      assessment: 'consistent',
      foundBy: 'archivist',
      date: { quality: 'exact', component: { year: 1923 } },
      text: 'extract',
    };
    const draft = citationToDraft(stored);
    expect(draft).toMatchObject({
      id: 'C1',
      sourceId: 'S1',
      targetType: 'person',
      targetId: 'P1',
      page: 'l. 14',
      text: 'extract',
      quality: 'primary',
      description: 'entry about Ivan',
      confidence: 'high',
      event: 'BIRT',
      role: 'witness',
      phrase: 'the record states',
      www: 'https://example.org/14',
      name: 'entry 14',
      qualityAssessment: 'high',
      reference: 'CREF-1',
      abbreviation: 'MB23',
      footnote: 'see the metric book',
      verified: true,
      assessment: 'consistent',
      foundBy: 'archivist',
      date: { ...emptyDate(), year: '1923' },
    });
    expect(citationDraftToRecord(draft)).toEqual(stored);
  });

  it('drops empty optional fields', () => {
    const record = citationDraftToRecord({
      ...citationToDraft(citation()),
      page: '   ',
      text: '  ',
    });
    expect(record.page).toBeUndefined();
    expect(record.text).toBeUndefined();
  });
});

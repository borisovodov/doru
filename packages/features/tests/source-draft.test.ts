import { describe, expect, it } from 'vitest';
import type { SourceRecord } from '@doru/core';
import { emptyDate } from '../src/person/draft';
import {
  emptySourceDraft,
  sourceDraftMatches,
  sourceDraftToRecord,
  sourceToDraft,
} from '../src/source/sourceDraft';

const source = (overrides: Partial<SourceRecord> = {}): SourceRecord => ({
  id: 'S1',
  title: 'Metric book',
  ...overrides,
});

describe('emptySourceDraft', () => {
  it('builds an empty draft with a fresh id', () => {
    const draft = emptySourceDraft();
    expect(draft.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(draft).toMatchObject({
      title: '',
      abbreviation: '',
      author: '',
      publication: '',
      medium: '',
      url: '',
      accessDate: '',
      confidence: '',
      agency: '',
      pubDate: emptyDate(),
      texts: [],
      dataEvents: [],
      repositories: [],
      templateFields: [],
    });
  });
});

describe('sourceToDraft / sourceDraftToRecord', () => {
  it('round-trips every field', () => {
    const stored: SourceRecord = {
      id: 'S1',
      xref: '@S1@',
      title: 'Metric book, 1923',
      abbreviation: 'MB23',
      author: 'State Archive',
      publication: 'Tula',
      medium: 'book',
      url: 'https://example.org',
      accessDate: '2026-01-02',
      confidence: 'high',
      agency: 'Archive',
      pubDate: { quality: 'exact', component: { year: 1923 } },
      pubPlace: 'Tula',
      titleId: 'T1',
      texts: [
        { id: 'T1', text: 'entry 14', mime: 'text/plain', language: 'ru' },
        { id: 'T2', text: 'entry 15' },
      ],
      dataEvents: [
        { id: 'E1', tag: 'BIRT', value: 'Ivan', date: { quality: 'exact', component: { year: 1923 } }, placeId: 'PL1' },
      ],
      repositories: [
        {
          id: 'R1',
          repositoryId: 'REP1',
          callNumbers: [
            { id: 'C1', value: '47-3-14', medium: 'paper' },
            { id: 'C2', value: '47-3-15' },
          ],
        },
      ],
      templateFields: [
        { id: 'F1', name: 'church', value: 'Nativity' },
        { id: 'F2', name: 'foliage' },
      ],
    };
    const draft = sourceToDraft(stored);
    expect(draft).toMatchObject({
      id: 'S1',
      xref: '@S1@',
      title: 'Metric book, 1923',
      abbreviation: 'MB23',
      author: 'State Archive',
      publication: 'Tula',
      medium: 'book',
      url: 'https://example.org',
      accessDate: '2026-01-02',
      confidence: 'high',
      agency: 'Archive',
      pubDate: { ...emptyDate(), year: '1923', place: 'Tula' },
      titleId: 'T1',
    });
    expect(sourceDraftToRecord(draft)).toEqual(stored);
  });

  it('drops empty sub-rows and empty fields', () => {
    const draft = emptySourceDraft();
    const record = sourceDraftToRecord({
      ...draft,
      title: '  Title  ',
      texts: [
        { id: 'T1', text: '   ', mime: '', language: '' },
        { id: 'T2', text: 'real text', mime: '', language: 'ru' },
      ],
      repositories: [{ id: 'R1', repositoryId: '', callNumbers: [{ id: 'C1', value: '  ', medium: '' }] }],
      templateFields: [{ id: 'F1', name: '  ', value: 'x' }],
    });
    expect(record.title).toBe('Title');
    expect(record.texts).toEqual([{ id: 'T2', text: 'real text', mime: undefined, language: 'ru' }]);
    expect(record.repositories).toEqual([]);
    expect(record.templateFields).toEqual([]);
  });
});

describe('sourceDraftMatches', () => {
  it('matches a draft built from the source', () => {
    const stored = source({
      texts: [{ id: 'T1', text: 'entry' }],
      dataEvents: [{ id: 'E1', tag: 'BIRT', date: { quality: 'exact', component: { year: 1923 } } }],
    });
    expect(sourceDraftMatches(sourceToDraft(stored), stored)).toBe(true);
  });

  it('detects field, sub-row and date changes', () => {
    const stored = source({ author: 'A', texts: [{ id: 'T1', text: 'entry' }] });
    const base = sourceToDraft(stored);
    expect(sourceDraftMatches({ ...base, author: 'B' }, stored)).toBe(false);
    expect(sourceDraftMatches({ ...base, texts: [{ id: 'T1', text: 'other' }] }, stored)).toBe(false);
    expect(sourceDraftMatches({ ...base, pubDate: { ...emptyDate(), year: '1930' } }, stored)).toBe(false);
  });
});

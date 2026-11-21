import { describe, expect, it } from 'vitest';
import type { CitationRecord, FamilyRecord, SourceRecord, TaskRecord } from '@doru/core';
import { emptyDate, fromDateDraft } from '../src/domain/person/draft';
import { citationDraftToRecord, citationToDraft } from '../src/domain/citation/citationDraft';
import { familyDraftToRecord, familyToDraft } from '../src/domain/family/familyDraft';
import { sourceDraftToRecord, sourceToDraft } from '../src/domain/source/sourceDraft';
import { taskDraftToRecord, taskToDraft } from '../src/domain/task/taskDraft';

describe('DateValue ids outside facts', () => {
  it('keeps the stored date id when the draft value is rebuilt', () => {
    const date = { id: 'D1', quality: 'exact' as const, component: { year: 1900 } };
    expect(fromDateDraft({ ...emptyDate(), year: '1900' }, date)).toEqual(date);
    expect(
      fromDateDraft({ ...emptyDate(), quality: 'range', year: '1900', endYear: '1910', modifier: 'CAL' }, date),
    ).toEqual({ ...date, quality: 'range', end: { year: 1910 }, modifier: 'CAL' });
  });

  it('keeps citation, source, family and task date ids', () => {
    const citation: CitationRecord = {
      id: 'C1',
      sourceId: 'S1',
      targetType: 'person',
      targetId: 'P1',
      date: { id: 'CD1', quality: 'exact', component: { year: 1900 } },
    };
    expect(citationDraftToRecord(citationToDraft(citation), citation).date?.id).toBe('CD1');

    const source: SourceRecord = {
      id: 'S1',
      title: 'Book',
      pubDate: { id: 'SD1', quality: 'exact', component: { year: 1900 } },
      dataEvents: [{ id: 'E1', tag: 'BIRT', date: { id: 'SD2', quality: 'exact', component: { year: 1901 } } }],
    };
    const sourceAfter = sourceDraftToRecord(sourceToDraft(source), source);
    expect(sourceAfter.pubDate?.id).toBe('SD1');
    expect(sourceAfter.dataEvents?.[0]?.date?.id).toBe('SD2');

    const family: FamilyRecord = {
      id: 'F1',
      partners: ['P1'],
      children: [],
      partnerLinks: [{ id: 'PL1', personId: 'P1', date: { id: 'FD1', quality: 'exact', component: { year: 1948 } } }],
      marriageStatuses: [
        { id: 'MS1', status: 'married', date: { id: 'FD2', quality: 'exact', component: { year: 1948 } } },
      ],
    };
    const familyAfter = familyDraftToRecord(familyToDraft(family), family);
    expect(familyAfter.partnerLinks?.[0]?.date?.id).toBe('FD1');
    expect(familyAfter.marriageStatuses?.[0]?.date?.id).toBe('FD2');

    const task: TaskRecord = {
      id: 'T1',
      text: 'Check the archive',
      createdDate: { id: 'TD1', quality: 'exact', component: { year: 2020 } },
      scheduledDate: { id: 'TD2', quality: 'exact', component: { year: 2021 } },
      reminderDate: { id: 'TD3', quality: 'exact', component: { year: 2022 } },
      closedDate: { id: 'TD4', quality: 'exact', component: { year: 2023 } },
    };
    const taskDraft = taskToDraft(task);
    taskDraft.scheduled = { ...taskDraft.scheduled, year: '2026' };
    taskDraft.reminder = emptyDate();
    const taskAfter = taskDraftToRecord(task, taskDraft);
    expect(taskAfter.createdDate?.id).toBe('TD1');
    expect(taskAfter.scheduledDate).toMatchObject({ id: 'TD2', component: { year: 2026 } });
    expect(taskAfter.reminderDate).toBeUndefined();
    expect(taskAfter.closedDate?.id).toBe('TD4');
  });
});

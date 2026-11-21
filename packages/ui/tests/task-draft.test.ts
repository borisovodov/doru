import { describe, expect, it } from 'vitest';
import type { TaskRecord } from '@doru/core';
import { emptyTaskDraft, taskDraftToRecord, taskToDraft } from '../src/domain/task/taskDraft';

const task = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: 'T1',
  text: 'Order the birth record',
  ...overrides,
});

describe('taskDraft', () => {
  it('round-trips a fully populated task', () => {
    const source: TaskRecord = {
      id: 'T1',
      text: 'Order the birth record',
      targetType: 'person',
      targetId: 'P1',
      priority: 'high',
      status: 'in-progress',
      scheduledDate: { quality: 'exact', component: { year: 2026, month: 3, day: 12 } },
      reminderDate: { quality: 'about', component: { year: 2026, month: 3 } },
      createdDate: { quality: 'exact', component: { year: 2026 } },
    };
    const draft = taskToDraft(source);
    expect(draft).toMatchObject({
      text: 'Order the birth record',
      priority: 'high',
      status: 'in-progress',
      targetType: 'person',
      targetId: 'P1',
      scheduled: { year: '2026', month: '3', day: '12', quality: 'exact' },
      created: { year: '2026' },
    });
    expect(taskDraftToRecord(source, draft)).toEqual(source);
  });

  it('defaults a new task to open and medium', () => {
    expect(emptyTaskDraft()).toMatchObject({ status: 'open', priority: 'medium' });
    expect(taskDraftToRecord(task(), emptyTaskDraft())).toMatchObject({ status: 'open', priority: 'medium' });
  });

  it('maps vendor priority spellings and treats unknown text as medium', () => {
    expect(taskToDraft(task({ priority: 'High' })).priority).toBe('high');
    expect(taskToDraft(task({ priority: 'HIGH' })).priority).toBe('high');
    expect(taskToDraft(task({ priority: 'normal' })).priority).toBe('medium');
    expect(taskToDraft(task({ priority: '8' })).priority).toBe('low');
    expect(taskToDraft(task({ priority: '5' })).priority).toBe('medium');
    expect(taskToDraft(task({ priority: '1' })).priority).toBe('high');
    expect(taskToDraft(task({ priority: 'needs review' })).priority).toBe('medium');
    expect(taskToDraft(task()).priority).toBe('medium');
  });

  it('maps vendor status spellings and treats missing/unknown text as open', () => {
    expect(taskToDraft(task()).status).toBe('open');
    expect(taskToDraft(task({ status: '' })).status).toBe('open');
    expect(taskToDraft(task({ status: 'InProgress' })).status).toBe('in-progress');
    expect(taskToDraft(task({ status: 'Completed' })).status).toBe('closed');
    expect(taskToDraft(task({ status: 'needs review' })).status).toBe('open');
    expect(taskToDraft(task({ status: 'waiting' })).status).toBe('waiting');
  });

  it('writes the edited fields and clears emptied ones', () => {
    const after = taskDraftToRecord(task(), {
      ...emptyTaskDraft(),
      text: ' Visit the cemetery ',
      priority: 'low',
      status: 'closed',
      targetType: 'person',
      targetId: 'P2',
      scheduled: { ...emptyTaskDraft().scheduled, year: '2027' },
    });
    expect(after).toEqual({
      id: 'T1',
      text: 'Visit the cemetery',
      targetType: 'person',
      targetId: 'P2',
      priority: 'low',
      status: 'closed',
      scheduledDate: { quality: 'exact', component: { year: 2027 } },
    });
  });

  it('detaches a task when the person is cleared', () => {
    const after = taskDraftToRecord(task({ targetType: 'person', targetId: 'P1' }), {
      ...taskToDraft(task({ targetType: 'person', targetId: 'P1' })),
      targetType: '',
      targetId: '',
    });
    expect(after.targetType).toBeUndefined();
    expect(after.targetId).toBeUndefined();
  });
});

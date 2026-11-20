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
      category: 'records',
      locality: 'archive',
      priority: 'high',
      status: 'in-progress',
      scheduledDate: { quality: 'exact', component: { year: 2026, month: 3, day: 12 } },
      reminderDate: { quality: 'about', component: { year: 2026, month: 3 } },
      repositoryId: 'R1',
      createdDate: { quality: 'exact', component: { year: 2026 } },
    };
    const draft = taskToDraft(source);
    expect(draft).toMatchObject({
      text: 'Order the birth record',
      category: 'records',
      locality: 'archive',
      priority: 'high',
      status: 'in-progress',
      repositoryId: 'R1',
      targetType: 'person',
      targetId: 'P1',
      scheduled: { year: '2026', month: '3', day: '12', quality: 'exact' },
      created: { year: '2026' },
    });
    expect(taskDraftToRecord(source, draft)).toEqual(source);
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

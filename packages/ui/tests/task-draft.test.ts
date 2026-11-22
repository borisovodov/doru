import { describe, expect, it } from 'vitest';
import type { TaskRecord } from '@doru/core';
import {
  emptyTaskDraft,
  inputToTimestamp,
  taskDraftHasInvalidTimestamp,
  taskDraftToRecord,
  taskToDraft,
  timestampToInput,
} from '../src/domain/task/taskDraft';

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
      scheduledAt: new Date(2026, 2, 12, 9, 0).getTime(),
      reminderAt: new Date(2026, 2, 1, 8, 30).getTime(),
      createdAt: new Date(2026, 0, 1, 10, 0).getTime(),
    };
    const draft = taskToDraft(source);
    expect(draft).toMatchObject({
      text: 'Order the birth record',
      priority: 'high',
      status: 'in-progress',
      targetType: 'person',
      targetId: 'P1',
      scheduledAt: '2026-03-12T09:00',
      reminderAt: '2026-03-01T08:30',
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
      scheduledAt: '2027-01-01T00:00',
    });
    expect(after).toEqual({
      id: 'T1',
      text: 'Visit the cemetery',
      targetType: 'person',
      targetId: 'P2',
      priority: 'low',
      status: 'closed',
      scheduledAt: new Date(2027, 0, 1, 0, 0).getTime(),
    });
  });

  it('preserves sub-minute instants when the visible draft is unchanged', () => {
    const scheduledAt = new Date(2026, 2, 12, 9, 0, 31, 456).getTime();
    const reminderAt = new Date(2026, 2, 11, 8, 15, 59, 999).getTime();
    const source = task({ scheduledAt, reminderAt });
    const draft = taskToDraft(source);
    draft.text = 'Edited elsewhere';

    const after = taskDraftToRecord(source, draft);
    expect(after.scheduledAt).toBe(scheduledAt);
    expect(after.reminderAt).toBe(reminderAt);
  });

  it('preserves the second occurrence of a repeated local time', () => {
    const previous = process.env['TZ'];
    process.env['TZ'] = 'America/New_York';
    try {
      const first = Date.parse('2024-11-03T05:30:00Z');
      const second = Date.parse('2024-11-03T06:30:00Z');
      expect(taskToDraft(task({ scheduledAt: first })).scheduledAt).toBe('2024-11-03T01:30');
      expect(taskToDraft(task({ scheduledAt: second })).scheduledAt).toBe('2024-11-03T01:30');

      const source = task({ scheduledAt: second });
      expect(taskDraftToRecord(source, taskToDraft(source)).scheduledAt).toBe(second);
    } finally {
      if (previous === undefined) {
        delete process.env['TZ'];
      } else {
        process.env['TZ'] = previous;
      }
    }
  });

  it('rejects a local time that does not exist', () => {
    const previous = process.env['TZ'];
    process.env['TZ'] = 'America/New_York';
    try {
      expect(inputToTimestamp('2024-03-10T02:30')).toBeUndefined();
      expect(
        taskDraftHasInvalidTimestamp({
          ...emptyTaskDraft(),
          scheduledAt: '2024-03-10T02:30',
        }),
      ).toBe(true);
      expect(
        taskDraftHasInvalidTimestamp({
          ...emptyTaskDraft(),
          reminderAt: '2024-03-10T02:30',
        }),
      ).toBe(true);
      expect(
        taskDraftHasInvalidTimestamp({
          ...emptyTaskDraft(),
          scheduledAt: '2024-03-10T03:30',
        }),
      ).toBe(false);
      expect(taskDraftHasInvalidTimestamp(emptyTaskDraft())).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env['TZ'];
      } else {
        process.env['TZ'] = previous;
      }
    }
  });

  it('keeps years below 100 in datetime-local values', () => {
    const expected = new Date(0);
    expected.setFullYear(99, 0, 1);
    expected.setHours(0, 0, 0, 0);

    expect(inputToTimestamp('0099-01-01T00:00')).toBe(expected.getTime());
    expect(timestampToInput(expected.getTime())).toBe('0099-01-01T00:00');
  });

  it('treats every value outside the Date range as absent', () => {
    expect(timestampToInput(8_640_000_000_000_001)).toBe('');
    const expandedYear = new Date(0);
    expandedYear.setFullYear(10_000, 0, 1);
    expandedYear.setHours(0, 0, 0, 0);
    expect(timestampToInput(expandedYear.getTime())).toBe('');
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

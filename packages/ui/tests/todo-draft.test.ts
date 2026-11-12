import { describe, expect, it } from 'vitest';
import type { TodoRecord } from '@doru/core';
import { emptyTodoDraft, todoDraftToRecord, todoToDraft } from '../src/domain/task/todoDraft';

const todo = (overrides: Partial<TodoRecord> = {}): TodoRecord => ({
  id: 'T1',
  text: 'Order the birth record',
  ...overrides,
});

describe('todoDraft', () => {
  it('round-trips a fully populated todo', () => {
    const source: TodoRecord = {
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
    const draft = todoToDraft(source);
    expect(draft).toMatchObject({
      text: 'Order the birth record',
      category: 'records',
      locality: 'archive',
      priority: 'high',
      status: 'in-progress',
      repositoryId: 'R1',
      personId: 'P1',
      scheduled: { year: '2026', month: '3', day: '12', quality: 'exact' },
    });
    expect(todoDraftToRecord(source, draft)).toEqual(source);
  });

  it('writes the edited fields and clears emptied ones', () => {
    const after = todoDraftToRecord(todo(), {
      ...emptyTodoDraft(),
      text: ' Visit the cemetery ',
      priority: 'low',
      status: 'closed',
      personId: 'P2',
      scheduled: { ...emptyTodoDraft().scheduled, year: '2027' },
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

  it('detaches a todo when the person is cleared', () => {
    const after = todoDraftToRecord(todo({ targetType: 'person', targetId: 'P1' }), {
      ...todoToDraft(todo({ targetType: 'person', targetId: 'P1' })),
      personId: '',
    });
    expect(after.targetType).toBeUndefined();
    expect(after.targetId).toBeUndefined();
  });
});

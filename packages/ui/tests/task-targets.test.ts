import { describe, expect, it } from 'vitest';
import { TASK_LINK_TARGET_TYPES } from '@doru/core/model';
import { TASK_TARGET_TYPES } from '../src/domain/task/taskTargets';

describe('TASK_TARGET_TYPES', () => {
  it('re-exports the core task link policy', () => {
    expect(TASK_TARGET_TYPES).toBe(TASK_LINK_TARGET_TYPES);
  });

  it('offers sources but not other tasks, submitters, or notes', () => {
    expect(TASK_TARGET_TYPES).toContain('source');
    expect(TASK_TARGET_TYPES).not.toContain('task');
    expect(TASK_TARGET_TYPES).not.toContain('submitter');
    expect(TASK_TARGET_TYPES).not.toContain('media_link');
    expect(TASK_TARGET_TYPES).not.toContain('note');
    expect(TASK_TARGET_TYPES).toContain('person');
    expect(TASK_TARGET_TYPES).toContain('citation');
  });
});

import { describe, expect, it } from 'vitest';
import type { TaskTargetData } from '../src/domain/task/taskTargets';
import { TASK_TARGET_TYPES, taskTargetLabel } from '../src/domain/task/taskTargets';

const data: TaskTargetData = {
  persons: [{ id: 'P1', sex: 'U', names: [{ id: 'N1', given: 'Alice' }], facts: [] }],
  families: [],
  sources: [],
  places: [],
  repositories: [],
  titles: [],
  facts: [],
  citations: [],
  media: [
    {
      id: 'M1',
      title: 'Portrait',
      files: [],
      links: [{ id: 'ML1', mediaId: 'M1', targetType: 'person', targetId: 'P1' }],
    },
  ],
  submitters: [],
  addresses: [],
  associations: [],
  tasks: [],
};

describe('TASK_TARGET_TYPES', () => {
  it('does not offer sources, other tasks, submitters, or notes as task targets', () => {
    expect(TASK_TARGET_TYPES).not.toContain('source');
    expect(TASK_TARGET_TYPES).not.toContain('task');
    expect(TASK_TARGET_TYPES).not.toContain('submitter');
    expect(TASK_TARGET_TYPES).not.toContain('note');
    expect(TASK_TARGET_TYPES).toContain('person');
    expect(TASK_TARGET_TYPES).toContain('citation');
  });
});

describe('taskTargetLabel', () => {
  it('resolves a known top-level media link to its readable label', () => {
    expect(taskTargetLabel('media_link', 'ML1', data)).toContain('Portrait');
    expect(taskTargetLabel('media_link', 'ML1', data)).toContain('Alice');
  });

  it('keeps the identifier fallback for missing and nested media links', () => {
    expect(taskTargetLabel('media_link', 'MISSING', data)).toBe('media_link:MISSING');
    const nested = {
      ...data,
      media: [
        {
          ...data.media[0]!,
          links: [
            {
              id: 'ML2',
              mediaId: 'M1',
              targetType: 'media_link',
              targetId: 'ML1',
            },
          ],
        },
      ],
    };
    expect(taskTargetLabel('media_link', 'ML2', nested)).toContain('media_link:ML1');
  });
});

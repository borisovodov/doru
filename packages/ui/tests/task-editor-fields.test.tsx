import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { TaskEditorFields } from '../src/domain/task/TaskEditorFields';
import { emptyTaskDraft } from '../src/domain/task/taskDraft';
import { nls } from '../src/nls';
import { renderUi } from '../../../test/ui/harness';

const data = {
  persons: [],
  families: [],
  sources: [],
  places: [],
  repositories: [],
  titles: [],
  facts: [],
  citations: [],
  notes: [],
  media: [],
  submitters: [],
  addresses: [],
  associations: [],
  tasks: [],
};

describe('TaskEditorFields', () => {
  it('associates a timestamp error with the invalid picker', () => {
    renderUi(
      <TaskEditorFields
        edit={{ ...emptyTaskDraft(), scheduledAt: '2026-02-30T10:00' }}
        data={data}
        onChange={vi.fn()}
      />,
    );

    const scheduled = screen.getByLabelText(nls.t('features.tasks.scheduled'));
    expect(scheduled).toHaveAttribute('aria-invalid', 'true');
    expect(scheduled).toHaveAccessibleDescription(nls.t('features.tasks.invalidTimestamp'));
  });

  it('leaves a valid picker without an error', () => {
    renderUi(
      <TaskEditorFields
        edit={{ ...emptyTaskDraft(), scheduledAt: '2026-11-22T10:00' }}
        data={data}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByText(nls.t('features.tasks.invalidTimestamp'))).not.toBeInTheDocument();
    expect(screen.getByLabelText(nls.t('features.tasks.scheduled'))).not.toHaveAttribute('aria-invalid');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { PersonRecord } from '@doru/core';
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
        targets={[]}
        onChange={vi.fn()}
        onChangeTargets={vi.fn()}
      />,
    );

    const scheduled = screen.getByLabelText(nls.t('features.tasks.scheduled'));
    expect(scheduled).toHaveAttribute('aria-invalid', 'true');
    expect(scheduled).toHaveAccessibleDescription(nls.t('features.tasks.invalidTimestamp'));
  });

  it('selects a target from the unified picker without a type step', () => {
    const person: PersonRecord = {
      id: 'P1',
      names: [{ id: 'N1', given: 'Ivan', surname: 'Petrov' }],
      sex: 'M',
      facts: [],
    };
    const onChangeTargets = vi.fn();
    renderUi(
      <TaskEditorFields
        edit={emptyTaskDraft()}
        data={{ ...data, persons: [person] }}
        targets={[]}
        targetTypes={['person']}
        onChange={vi.fn()}
        onChangeTargets={onChangeTargets}
      />,
    );

    const picker = screen.getByRole('combobox', { name: nls.t('features.tasks.target') });
    fireEvent.focus(picker);
    fireEvent.click(screen.getByRole('option', { name: 'Ivan PetrovPerson' }));
    expect(onChangeTargets).toHaveBeenCalledWith([{ targetType: 'person', targetId: 'P1' }]);
  });

  it('leaves a valid picker without an error', () => {
    renderUi(
      <TaskEditorFields
        edit={{ ...emptyTaskDraft(), scheduledAt: '2026-11-22T10:00' }}
        data={data}
        targets={[]}
        onChange={vi.fn()}
        onChangeTargets={vi.fn()}
      />,
    );

    expect(screen.queryByText(nls.t('features.tasks.invalidTimestamp'))).not.toBeInTheDocument();
    expect(screen.getByLabelText(nls.t('features.tasks.scheduled'))).not.toHaveAttribute('aria-invalid');
  });
});

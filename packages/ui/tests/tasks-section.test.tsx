import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { TasksSection } from '../src/domain/task/TasksSection';
import { nls } from '../src/nls';
import { renderUi } from '../../../test/ui/harness';

const api = {
  getTasksFor: async () => [],
  addTask: async () => undefined,
  deleteTask: async () => undefined,
};

describe('TasksSection', () => {
  it('does not offer inline task creation on a source or another task', () => {
    renderUi(<TasksSection targetType="source" targetId="S1" api={api} />);
    expect(screen.queryByRole('button', { name: nls.t('features.tasks.add') })).not.toBeInTheDocument();
  });

  it('still offers inline task creation on a person', () => {
    renderUi(<TasksSection targetType="person" targetId="P1" api={api} />);
    expect(screen.getByRole('button', { name: nls.t('features.tasks.add') })).toBeInTheDocument();
  });
});

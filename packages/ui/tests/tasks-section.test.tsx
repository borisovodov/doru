import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { TaskRecord } from '@doru/core';
import { TasksSection } from '../src/domain/task/TasksSection';
import { nls } from '../src/nls';
import { renderUi } from '../../../test/ui/harness';

const api = {
  getTasksFor: async () => [],
  addTask: async () => undefined,
  deleteTaskLink: async () => undefined,
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

  it('removes only the link of the current record from a shared task', async () => {
    const task: TaskRecord = {
      id: 'T1',
      text: 'Find the parish register',
      targets: [
        { id: 'TL1', taskId: 'T1', targetType: 'person', targetId: 'P1' },
        { id: 'TL2', taskId: 'T1', targetType: 'place', targetId: 'PL1' },
      ],
    };
    const deleteTaskLink = vi.fn(async () => undefined);
    const deleteTask = vi.fn(async () => undefined);
    const sectionApi = {
      getTasksFor: async () => [task],
      addTask: async () => undefined,
      deleteTaskLink,
      deleteTask,
    };

    renderUi(<TasksSection targetType="person" targetId="P1" api={sectionApi} />);
    await screen.findByText(task.text);
    screen.getByRole('button', { name: nls.t('features.tasks.remove') }).click();

    await waitFor(() => expect(deleteTaskLink).toHaveBeenCalledWith(task.targets[0]));
    expect(deleteTaskLink).toHaveBeenCalledTimes(1);
    expect(deleteTask).not.toHaveBeenCalled();
  });

  it('reports a failed detach', async () => {
    const task: TaskRecord = {
      id: 'T1',
      text: 'Find the parish register',
      targets: [{ id: 'TL1', taskId: 'T1', targetType: 'person', targetId: 'P1' }],
    };
    const deleteTaskLink = vi.fn(async () => {
      throw new Error('disk full');
    });
    const sectionApi = {
      getTasksFor: async () => [task],
      addTask: async () => undefined,
      deleteTaskLink,
    };

    renderUi(<TasksSection targetType="person" targetId="P1" api={sectionApi} />);
    await screen.findByText(task.text);
    screen.getByRole('button', { name: nls.t('features.tasks.remove') }).click();

    await waitFor(() => expect(deleteTaskLink).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(nls.t('features.tree.autosaveFailed'))).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { TaskRecord } from '@doru/core';
import { TasksSection } from '../src/domain/task/TasksSection';
import { nls } from '../src/nls';
import { renderUi } from '../../../test/ui/harness';

const api = {
  getTasksFor: async () => [],
  getAllTasks: async () => [],
  addTask: async () => undefined,
  addTaskLink: async () => undefined,
  deleteTaskLink: async () => undefined,
};

describe('TasksSection', () => {
  it('does not offer inline task creation on another task', () => {
    renderUi(<TasksSection targetType="task" targetId="T2" api={api} />);
    expect(screen.queryByRole('button', { name: nls.t('features.tasks.add') })).not.toBeInTheDocument();
  });

  it('offers inline task creation on a source', () => {
    renderUi(<TasksSection targetType="source" targetId="S1" api={api} />);
    expect(screen.getByRole('button', { name: nls.t('features.tasks.add') })).toBeInTheDocument();
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
      getAllTasks: async () => [task],
      addTask: async () => undefined,
      addTaskLink: async () => undefined,
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

  it('attaches an existing task that is not linked to the record yet', async () => {
    const linked: TaskRecord = {
      id: 'T1',
      text: 'Find the parish register',
      targets: [{ id: 'TL1', taskId: 'T1', targetType: 'person', targetId: 'P1' }],
    };
    const candidate: TaskRecord = {
      id: 'T2',
      text: 'Translate the 1890 census',
      targets: [],
    };
    let attached = false;
    const addTaskLink = vi.fn(async () => {
      attached = true;
    });
    const sectionApi = {
      getTasksFor: async () => (attached ? [linked, candidate] : [linked]),
      getAllTasks: async () => [linked, candidate],
      addTask: async () => undefined,
      addTaskLink,
      deleteTaskLink: async () => undefined,
    };

    renderUi(<TasksSection targetType="person" targetId="P1" api={sectionApi} />);
    await screen.findByText(linked.text);

    const select = screen.getByRole('combobox', { name: nls.t('features.tasks.attachExisting') });
    expect(within(select).queryByRole('option', { name: linked.text })).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'T2' } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tasks.attach') }));

    await waitFor(() =>
      expect(addTaskLink).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 'T2', targetType: 'person', targetId: 'P1' }),
      ),
    );
    const taskList = screen.getByRole('list');
    await waitFor(() => expect(within(taskList).getByText(candidate.text)).toBeInTheDocument());
  });

  it('reports a failed attach and keeps the candidate selected', async () => {
    const candidate: TaskRecord = { id: 'T2', text: 'Translate the 1890 census', targets: [] };
    const addTaskLink = vi.fn(async () => {
      throw new Error('disk full');
    });
    const sectionApi = {
      getTasksFor: async () => [],
      getAllTasks: async () => [candidate],
      addTask: async () => undefined,
      addTaskLink,
      deleteTaskLink: async () => undefined,
    };

    renderUi(<TasksSection targetType="person" targetId="P1" api={sectionApi} />);
    const select = await screen.findByRole('combobox', { name: nls.t('features.tasks.attachExisting') });
    fireEvent.change(select, { target: { value: 'T2' } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tasks.attach') }));

    await waitFor(() => expect(addTaskLink).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(nls.t('features.tree.autosaveFailed'))).toBeInTheDocument();
    expect(select).toHaveValue('T2');
  });

  it('clears a failed attach error after a successful detach', async () => {
    const linked: TaskRecord = {
      id: 'T1',
      text: 'Find the parish register',
      targets: [{ id: 'TL1', taskId: 'T1', targetType: 'person', targetId: 'P1' }],
    };
    const candidate: TaskRecord = { id: 'T2', text: 'Translate the 1890 census', targets: [] };
    let hasLinked = true;
    const sectionApi = {
      getTasksFor: async () => (hasLinked ? [linked] : []),
      getAllTasks: async () => [linked, candidate],
      addTask: async () => undefined,
      addTaskLink: async () => {
        throw new Error('disk full');
      },
      deleteTaskLink: async () => {
        hasLinked = false;
      },
    };

    renderUi(<TasksSection targetType="person" targetId="P1" api={sectionApi} />);
    await screen.findByText(linked.text);

    const select = screen.getByRole('combobox', { name: nls.t('features.tasks.attachExisting') });
    fireEvent.change(select, { target: { value: 'T2' } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tasks.attach') }));
    await screen.findByText(nls.t('features.tree.autosaveFailed'));

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tasks.remove') }));
    await waitFor(() => expect(screen.queryByText(nls.t('features.tree.autosaveFailed'))).not.toBeInTheDocument());
  });

  it('does not offer an existing task on a submitter', async () => {
    renderUi(
      <TasksSection
        targetType="submitter"
        targetId="SU1"
        api={{ ...api, getAllTasks: async () => [{ id: 'T2', text: 'Translate the 1890 census', targets: [] }] }}
      />,
    );

    await waitFor(() =>
      expect(screen.queryByRole('combobox', { name: nls.t('features.tasks.attachExisting') })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('region', { name: nls.t('features.tasks.title') })).not.toBeInTheDocument();
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
      getAllTasks: async () => [task],
      addTask: async () => undefined,
      addTaskLink: async () => undefined,
      deleteTaskLink,
    };

    renderUi(<TasksSection targetType="person" targetId="P1" api={sectionApi} />);
    await screen.findByText(task.text);
    screen.getByRole('button', { name: nls.t('features.tasks.remove') }).click();

    await waitFor(() => expect(deleteTaskLink).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(nls.t('features.tree.autosaveFailed'))).toBeInTheDocument();
  });
});

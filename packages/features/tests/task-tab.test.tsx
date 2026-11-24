import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { TaskRecord } from '@doru/core';
import { TaskTab } from '@doru/features/task';
import type { TaskEditorApi } from '../src/person';
import { nls } from '../src/nls';
import { renderUi, stubApi } from '../../../test/ui/harness';

function apiStub(overrides: Partial<TaskEditorApi> = {}): TaskEditorApi {
  return stubApi<TaskEditorApi>({
    getNotes: async () => [],
    getAllNotes: async () => [],
    getCitations: async () => [],
    getTags: async () => [],
    getTagLinks: async () => [],
    getIdentifiers: async () => [],
    getContacts: async () => [],
    getSubmitters: async () => [],
    getRecordSubmitters: async () => [],
    getMediaFor: async () => [],
    getAllMedia: async () => [],
    getTasksFor: async () => [],
    getSources: async () => [],
    ...overrides,
  });
}

const emptyTargetData = {
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
};

function taskElement(entityId: string, tasks: TaskRecord[], api: TaskEditorApi) {
  return (
    <TaskTab
      entityId={entityId}
      tasks={tasks}
      {...emptyTargetData}
      api={api}
      onClose={vi.fn()}
      onOpenMedia={vi.fn()}
      onCreated={vi.fn()}
    />
  );
}

describe('TaskTab', () => {
  it('does not offer source or contact attachments', () => {
    const task: TaskRecord = { id: 'T1', text: 'Find the record', targets: [] };
    renderUi(taskElement(task.id, [task], apiStub()));

    expect(screen.queryByText(nls.t('features.tree.sources.title'))).not.toBeInTheDocument();
    expect(screen.queryByText(nls.t('features.tree.contacts.title'))).not.toBeInTheDocument();
    expect(screen.getByText(nls.t('features.tree.notes.title'))).toBeInTheDocument();
  });

  it('places Related to after the tags block', () => {
    const task: TaskRecord = { id: 'T1', text: 'Find the record', targets: [] };
    renderUi(taskElement(task.id, [task], apiStub()));

    const tags = screen.getByRole('region', { name: nls.t('features.tree.tags.title') });
    const related = screen.getByRole('region', { name: nls.t('features.tasks.target') });
    expect(tags.compareDocumentPosition(related) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('runs one create request for repeated clicks', async () => {
    let finishCreate!: () => void;
    const addTask = vi.fn(
      (_task: TaskRecord) =>
        new Promise<void>((resolve) => {
          finishCreate = resolve;
        }),
    );
    const api = apiStub({ addTask });
    renderUi(taskElement('new:1', [], api));

    fireEvent.change(screen.getByPlaceholderText(nls.t('features.tasks.text')), {
      target: { value: 'Write a report' },
    });
    const create = screen.getByRole('button', { name: nls.t('features.tree.create') });
    fireEvent.click(create);
    fireEvent.click(create);
    expect(addTask).toHaveBeenCalledTimes(1);
    await act(async () => finishCreate());
  });

  it('keeps a refreshed status when only the text is edited', async () => {
    const openTask: TaskRecord = { id: 'T1', text: 'Old text', status: 'open', targets: [] };
    const closedTask: TaskRecord = { ...openTask, status: 'closed' };
    const updateTask = vi.fn(async (_before: TaskRecord, _after: TaskRecord) => undefined);
    const api = apiStub({ updateTask });
    const view = renderUi(taskElement(openTask.id, [openTask], api));

    view.rerender(taskElement(closedTask.id, [closedTask], api));

    const text = screen.getByPlaceholderText(nls.t('features.tasks.text'));
    fireEvent.change(text, { target: { value: 'New text' } });
    fireEvent.blur(text, { relatedTarget: document.body });

    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(1));
    const after = updateTask.mock.calls[0]?.[1];
    expect(after?.text).toBe('New text');
    expect(after?.status).toBe('closed');
  });

  it('keeps a post-submission status reversal', async () => {
    const openTask: TaskRecord = { id: 'T1', text: 'Old text', status: 'open', targets: [] };
    const closedTask: TaskRecord = { ...openTask, status: 'closed' };
    let finishSave!: () => void;
    const updateTask = vi.fn(
      (_before: TaskRecord, _after: TaskRecord) =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    const api = apiStub({ updateTask });
    const view = renderUi(taskElement(openTask.id, [openTask], api));

    const status = screen.getByLabelText(nls.t('features.tasks.status'));
    fireEvent.change(status, { target: { value: 'closed' } });
    fireEvent.blur(status, { relatedTarget: document.body });
    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(1));

    fireEvent.change(status, { target: { value: 'open' } });
    await act(async () => finishSave());
    view.rerender(taskElement(closedTask.id, [closedTask], api));

    await waitFor(() => expect(status).toHaveValue('open'));
  });

  it('keeps a newer persisted baseline when an older save completes', async () => {
    const openTask: TaskRecord = { id: 'T1', text: 'Old text', status: 'open', targets: [] };
    const waitingTask: TaskRecord = { ...openTask, status: 'waiting' };
    let finishSave!: () => void;
    const updateTask = vi.fn(
      (_before: TaskRecord, _after: TaskRecord) =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    const api = apiStub({ updateTask });
    const view = renderUi(taskElement(openTask.id, [openTask], api));

    const status = screen.getByLabelText(nls.t('features.tasks.status'));
    fireEvent.change(status, { target: { value: 'closed' } });
    fireEvent.blur(status, { relatedTarget: document.body });
    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(1));

    view.rerender(taskElement(waitingTask.id, [waitingTask], api));
    await act(async () => finishSave());

    fireEvent.blur(status, { relatedTarget: document.body });
    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(2));
    const after = updateTask.mock.calls[1]?.[1];
    expect(after?.status).toBe('closed');
  });

  it('advances the baseline after a fresh pre-write refresh', async () => {
    const openTask: TaskRecord = { id: 'T1', text: 'Old', status: 'open', targets: [] };
    let finishSave!: () => void;
    const updateTask = vi.fn(
      (_before: TaskRecord, _after: TaskRecord) =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    const api = apiStub({ updateTask });
    const view = renderUi(taskElement(openTask.id, [openTask], api));

    const text = screen.getByPlaceholderText(nls.t('features.tasks.text'));
    fireEvent.change(text, { target: { value: 'New' } });
    fireEvent.blur(text, { relatedTarget: document.body });
    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(1));

    view.rerender(taskElement(openTask.id, [{ ...openTask }], api));
    await act(async () => finishSave());

    fireEvent.change(text, { target: { value: 'Old' } });
    fireEvent.blur(text, { relatedTarget: document.body });
    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(2));
    expect(updateTask.mock.calls[1]?.[1]).toMatchObject({ text: 'Old' });
  });

  it('keeps a target added while a field save is pending', async () => {
    const task: TaskRecord = {
      id: 'T1',
      text: 'Old text',
      status: 'open',
      targets: [{ id: 'TL1', taskId: 'T1', targetType: 'person', targetId: 'P1' }],
    };
    const refreshed: TaskRecord = {
      ...task,
      targets: [...task.targets, { id: 'TL2', taskId: 'T1', targetType: 'person', targetId: 'P2' }],
    };
    let finishSave!: () => void;
    const updateTask = vi.fn(
      (_before: TaskRecord, _after: TaskRecord) =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    const api = apiStub({ updateTask });
    const view = renderUi(taskElement(task.id, [task], api));

    const text = screen.getByPlaceholderText(nls.t('features.tasks.text'));
    fireEvent.change(text, { target: { value: 'New text' } });
    fireEvent.blur(text, { relatedTarget: document.body });
    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(1));

    view.rerender(taskElement(task.id, [refreshed], api));
    await act(async () => finishSave());

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: nls.t('features.targets.remove') })).toHaveLength(2),
    );
  });

  it('shows a creation error when adding a task fails', async () => {
    const addTask = vi.fn(async () => {
      throw new Error('disk full');
    });
    const api = apiStub({ addTask });
    renderUi(taskElement('new:1', [], api));

    const text = screen.getByPlaceholderText(nls.t('features.tasks.text'));
    fireEvent.change(text, { target: { value: 'Write a report' } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.create') }));
    await waitFor(() => expect(addTask).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(nls.t('features.tree.autosaveFailed'))).toBeInTheDocument();

    fireEvent.change(text, { target: { value: 'Write a new report' } });
    expect(screen.queryByText(nls.t('features.tree.autosaveFailed'))).not.toBeInTheDocument();
  });

  it('shows an error when unlinking an existing task target fails', async () => {
    const task: TaskRecord = {
      id: 'T1',
      text: 'Find the record',
      targets: [{ id: 'TL1', taskId: 'T1', targetType: 'person', targetId: 'P1' }],
    };
    const deleteTaskLink = vi.fn(async () => {
      throw new Error('disk full');
    });
    const api = apiStub({ deleteTaskLink });
    renderUi(taskElement(task.id, [task], api));

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.targets.remove') }));
    await waitFor(() => expect(deleteTaskLink).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(nls.t('features.tree.autosaveFailed'))).toBeInTheDocument();
  });
});

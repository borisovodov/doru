import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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
    getRestrictions: async () => [],
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
      onOpenSource={vi.fn()}
      onCreated={vi.fn()}
    />
  );
}

describe('TaskTab', () => {
  it('keeps a refreshed status when only the text is edited', async () => {
    const openTask: TaskRecord = { id: 'T1', text: 'Old text', status: 'open' };
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
});

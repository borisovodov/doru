import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { PersonTab } from '@doru/features/person';
import type { PersonRecord } from '@doru/core';
import type { MediaTargetApi, PersonEditorApi } from '@doru/features/person';
import { nls } from '../src/nls';
import { renderUi, stubApi } from '../../../test/ui/harness';

function renderTab(
  overrides: {
    entityId?: string;
    persons?: PersonRecord[];
    onClose?: () => void;
    onCreated?: (realId: string) => void;
    updatePerson?: (before: PersonRecord, after: PersonRecord) => Promise<void>;
  } = {},
) {
  const addPerson = vi.fn(async () => {});
  const updatePerson = vi.fn(overrides.updatePerson ?? (async (_before: PersonRecord, _after: PersonRecord) => {}));
  const api = stubApi<PersonEditorApi>({
    addPerson,
    updatePerson,
    getFamilies: async () => [],
    getPlaces: async () => [],
    getAddresses: async () => [],
    getNotes: async () => [],
    getCitations: async () => [],
    getContacts: async () => [],
    getTasksFor: async () => [],
    getAllTasks: async () => [],
    getSources: async () => [],
    getSubmitterLinks: async () => [],
    getAssociations: async () => [],
    getFacts: async () => [],
    getMedia: async () => [],
    getMediaFor: async () => [],
    getAllMedia: async () => [],
    getSubmitters: async () => [],
  });
  const mediaApi = stubApi<MediaTargetApi>({
    getMediaFor: async () => [],
    getAllMedia: async () => [],
  });

  renderUi(
    <PersonTab
      entityId={overrides.entityId ?? 'new:1'}
      persons={overrides.persons ?? []}
      api={api}
      mediaApi={mediaApi}
      onOpenMedia={vi.fn()}
      onClose={overrides.onClose ?? vi.fn()}
      onCreated={overrides.onCreated ?? vi.fn()}
      onDeletePerson={vi.fn(async () => {})}
    />,
  );

  return { addPerson, updatePerson };
}

describe('PersonTab', () => {
  it('creates a new person only on Create, not on a field blur', async () => {
    const onCreated = vi.fn();
    const { addPerson } = renderTab({ onCreated });
    const name = screen.getByDisplayValue(nls.t('features.tree.person.newPerson'));

    fireEvent.change(name, { target: { value: 'Ada Lovelace' } });
    fireEvent.blur(name, { relatedTarget: document.body });
    expect(addPerson).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.create') }));

    await waitFor(() => expect(addPerson).toHaveBeenCalledTimes(1));
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith(expect.any(String));
  });

  it('shows a save failure and retries it without dropping the draft', async () => {
    const person: PersonRecord = {
      id: 'P1',
      names: [{ id: 'N1', given: 'Ivan', surname: 'Ivanov' }],
      sex: 'M',
      facts: [],
    };
    let reject = true;
    const { updatePerson } = renderTab({
      entityId: 'P1',
      persons: [person],
      updatePerson: async () => {
        if (reject) {
          reject = false;
          throw new Error('offline');
        }
      },
    });
    const given = screen.getByDisplayValue('Ivan');
    fireEvent.change(given, { target: { value: 'Ivan Jr' } });
    fireEvent.blur(given, { relatedTarget: document.body });

    await waitFor(() => expect(updatePerson).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(nls.t('features.tree.autosaveFailed'))).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ivan Jr')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.retry') }));
    await waitFor(() => expect(updatePerson).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(nls.t('features.tree.autosaveFailed'))).not.toBeInTheDocument());
  });

  it('autosaves an existing person when a field loses focus', async () => {
    const person: PersonRecord = {
      id: 'P1',
      names: [{ id: 'N1', given: 'Ivan', surname: 'Ivanov' }],
      sex: 'M',
      facts: [],
    };
    const { updatePerson } = renderTab({ entityId: 'P1', persons: [person] });
    const given = screen.getByDisplayValue('Ivan');

    fireEvent.change(given, { target: { value: 'Ivan Jr' } });
    fireEvent.blur(given, { relatedTarget: document.body });

    await waitFor(() => expect(updatePerson).toHaveBeenCalledTimes(1));
    expect(updatePerson.mock.calls[0]?.[1]).toMatchObject({
      names: [expect.objectContaining({ given: 'Ivan Jr' })],
    });
  });

  it('closes a new draft without saving', () => {
    const onClose = vi.fn();
    const { addPerson } = renderTab({ onClose });

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.back') }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(addPerson).not.toHaveBeenCalled();
  });

  it('shows a missing-person message for an unknown id', () => {
    renderTab({ entityId: 'missing' });
    expect(screen.getByText(nls.t('features.tree.personNotFound'))).toBeInTheDocument();
  });
});

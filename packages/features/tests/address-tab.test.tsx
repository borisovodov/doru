import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { AddressTab } from '@doru/features/registries';
import type { AddressRecord } from '@doru/core';
import type { RegistriesEditorApi } from '../src/person';
import { nls } from '../src/nls';
import { renderUi, stubApi } from '../../../test/ui/harness';

const record: AddressRecord = { id: 'A1', lines: [{ id: 'AL1', value: 'Main street 1' }] };

function apiStub(overrides: Partial<RegistriesEditorApi>): RegistriesEditorApi {
  return stubApi<RegistriesEditorApi>({
    getNotes: async () => [],
    getCitations: async () => [],
    getContacts: async () => [],
    getSubmitters: async () => [],
    getRecordSubmitters: async () => [],
    getMediaFor: async () => [],
    getAllMedia: async () => [],
    getTasksFor: async () => [],
    getAllTasks: async () => [],
    getSources: async () => [],
    ...overrides,
  });
}

describe('AddressTab', () => {
  it('shows a failed save and allows recreating a concurrently deleted address', async () => {
    const updateAddress = vi.fn(async () => {
      throw new Error('address A1 no longer exists');
    });
    const deleted = { value: false };
    const getAddress = vi.fn(async () => {
      if (!deleted.value) {
        return record;
      }
      return undefined;
    });
    const addAddress = vi.fn(async () => {});
    const api = apiStub({ getAddress, updateAddress, addAddress });

    renderUi(
      <AddressTab
        entityId="A1"
        addresses={[record]}
        facts={[]}
        repositories={[]}
        submitters={[]}
        sources={[]}
        api={api}
        onClose={vi.fn()}
        onOpenSource={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    const street = await screen.findByDisplayValue('Main street 1');
    fireEvent.change(street, { target: { value: 'Main street 2' } });
    deleted.value = true;
    fireEvent.blur(street, { relatedTarget: document.body });
    await waitFor(() => expect(updateAddress).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(nls.t('features.tree.address.saveFailed'))).toBeInTheDocument();

    fireEvent.blur(street, { relatedTarget: document.body });
    await waitFor(() => expect(addAddress).toHaveBeenCalledTimes(1));
    expect(updateAddress).toHaveBeenCalledTimes(1);
  });

  it('shows a delete failure and clears it on retry', async () => {
    let failing = true;
    const deleteAddress = vi.fn(async () => {
      if (failing) {
        failing = false;
        throw new Error('still referenced');
      }
    });
    const api = apiStub({ getAddress: async () => record, deleteAddress });

    renderUi(
      <AddressTab
        entityId="A1"
        addresses={[record]}
        facts={[]}
        repositories={[]}
        submitters={[]}
        sources={[]}
        api={api}
        onClose={vi.fn()}
        onOpenSource={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await screen.findByDisplayValue('Main street 1');
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.fact.delete') }));
    expect(await screen.findByText(nls.t('features.tree.deleteFailed'))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.fact.delete') }));
    await waitFor(() => expect(screen.queryByText(nls.t('features.tree.deleteFailed'))).not.toBeInTheDocument());
    expect(deleteAddress).toHaveBeenCalledTimes(2);
  });

  it('shows a load failure and retries the address lookup', async () => {
    let attempts = 0;
    const getAddress = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('offline');
      }
      return record;
    });
    const api = apiStub({ getAddress });

    renderUi(
      <AddressTab
        entityId="A1"
        addresses={[record]}
        facts={[]}
        repositories={[]}
        submitters={[]}
        sources={[]}
        api={api}
        onClose={vi.fn()}
        onOpenSource={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    expect(await screen.findByText(nls.t('features.tree.address.loadFailed'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.retry') }));
    expect(await screen.findByDisplayValue('Main street 1')).toBeInTheDocument();
    expect(getAddress).toHaveBeenCalledTimes(2);
  });

  it('does not accept edits until the stored address has loaded', async () => {
    let resolveLoaded!: (value: AddressRecord | undefined) => void;
    const getAddress = vi.fn(
      () =>
        new Promise<AddressRecord | undefined>((resolve) => {
          resolveLoaded = resolve;
        }),
    );
    const api = apiStub({ getAddress });

    renderUi(
      <AddressTab
        entityId="A1"
        addresses={[record]}
        facts={[]}
        repositories={[]}
        submitters={[]}
        sources={[]}
        api={api}
        onClose={vi.fn()}
        onOpenSource={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    expect(screen.queryByPlaceholderText(nls.t('features.tree.address.line'))).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Main street 1')).not.toBeInTheDocument();
    await act(async () => resolveLoaded(record));
    expect(await screen.findByDisplayValue('Main street 1')).toBeInTheDocument();
  });

  it('shows a failed save when creating an address fails', async () => {
    const addAddress = vi.fn(async () => {
      throw new Error('disk full');
    });
    const api = apiStub({ addAddress });

    renderUi(
      <AddressTab
        entityId="new:1"
        addresses={[]}
        facts={[]}
        repositories={[]}
        submitters={[]}
        sources={[]}
        api={api}
        onClose={vi.fn()}
        onOpenSource={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(nls.t('features.tree.address.city')), {
      target: { value: 'Moscow' },
    });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.create') }));
    await waitFor(() => expect(addAddress).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(nls.t('features.tree.address.saveFailed'))).toBeInTheDocument();
  });
});

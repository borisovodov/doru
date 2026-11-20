import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { AddressTab } from '@doru/features/registries';
import type { AddressRecord } from '@doru/core';
import type { RegistriesEditorApi } from '../src/person';
import { nls } from '../src/nls';
import { renderUi, stubApi } from '../../../test/ui/harness';

const record: AddressRecord = { id: 'A1', lines: [{ id: 'AL1', value: 'Main street 1' }] };

function apiStub(overrides: Partial<RegistriesEditorApi>): RegistriesEditorApi {
  return stubApi<RegistriesEditorApi>({
    getNotes: async () => [],
    getAllNotes: async () => [],
    getCitations: async () => [],
    getTags: async () => [],
    getTagLinks: async () => [],
    getIdentifiers: async () => [],
    getContacts: async () => [],
    getRestrictions: async () => [],
    getChanges: async () => [],
    getSubmitters: async () => [],
    getRecordSubmitters: async () => [],
    getMediaFor: async () => [],
    getAllMedia: async () => [],
    getTodosFor: async () => [],
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

    await screen.findByDisplayValue('Main street 1');
    deleted.value = true;
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));
    await waitFor(() => expect(updateAddress).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toHaveTextContent(nls.t('features.tree.address.saveFailed'));

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));
    await waitFor(() => expect(addAddress).toHaveBeenCalledTimes(1));
    expect(updateAddress).toHaveBeenCalledTimes(1);
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
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));
    await waitFor(() => expect(addAddress).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toHaveTextContent(nls.t('features.tree.address.saveFailed'));
  });
});

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { PersonTab } from '@doru/features/person';
import type { MediaTargetApi, PersonEditorApi } from '@doru/features/person';
import { nls } from '../src/nls';
import { renderUi, stubApi } from '../../../test/ui/harness';

function renderTab(
  overrides: {
    entityId?: string;
    onClose?: () => void;
    onCreated?: (realId: string) => void;
  } = {},
) {
  const addPerson = vi.fn(async () => {});
  const api = stubApi<PersonEditorApi>({
    addPerson,
    getFamilies: async () => [],
    getPlaces: async () => [],
    getAddresses: async () => [],
    getTags: async () => [],
  });
  const mediaApi = stubApi<MediaTargetApi>({
    getMediaFor: async () => [],
    getAllMedia: async () => [],
  });

  renderUi(
    <PersonTab
      entityId={overrides.entityId ?? 'new:1'}
      persons={[]}
      api={api}
      mediaApi={mediaApi}
      onOpenMedia={vi.fn()}
      onClose={overrides.onClose ?? vi.fn()}
      onCreated={overrides.onCreated ?? vi.fn()}
      onDeletePerson={vi.fn(async () => {})}
    />,
  );

  return { addPerson };
}

describe('PersonTab', () => {
  it('saves a new person and reports the created id', async () => {
    const onCreated = vi.fn();
    const { addPerson } = renderTab({ onCreated });

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));

    await waitFor(() => expect(addPerson).toHaveBeenCalledTimes(1));
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith(expect.any(String));
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

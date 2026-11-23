import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { TitleTab } from '@doru/features/registries';
import type { TitleEditorApi } from '../src/person';
import { nls } from '../src/nls';
import { renderUi, stubApi } from '../../../test/ui/harness';

describe('TitleTab', () => {
  it('shows a creation error and clears it when the title is edited', async () => {
    const addTitle = vi.fn(async () => {
      throw new Error('disk full');
    });
    const api = stubApi<TitleEditorApi>({ addTitle });

    renderUi(
      <TitleTab
        entityId="new:1"
        titles={[]}
        sources={[]}
        repositories={[]}
        api={api}
        onClose={vi.fn()}
        onOpenSource={vi.fn()}
        onOpenMedia={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.create') }));
    await waitFor(() => expect(addTitle).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(nls.t('features.tree.autosaveFailed'))).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(nls.t('features.tree.title.name')), {
      target: { value: 'A new title' },
    });
    expect(screen.queryByText(nls.t('features.tree.autosaveFailed'))).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.create') }));
    await waitFor(() => expect(addTitle).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(nls.t('features.tree.autosaveFailed'))).toBeInTheDocument();
  });
});

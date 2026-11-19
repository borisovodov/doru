import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { SourceTab } from '@doru/features/source';
import type { MediaTargetApi, SourceEditorApi } from '@doru/features/person';
import { nls } from '../src/nls';
import { renderUi, stubApi } from '../../../test/ui/harness';

function renderTab(overrides: { entityId?: string; onCreated?: (realId: string) => void } = {}) {
  const addSource = vi.fn(async () => {});
  const api = stubApi<SourceEditorApi>({
    addSource,
    getRepositories: async () => [],
    getTitles: async () => [],
  });
  const mediaApi = stubApi<MediaTargetApi>({
    getMediaFor: async () => [],
    getAllMedia: async () => [],
  });

  renderUi(
    <SourceTab
      entityId={overrides.entityId ?? 'new:1'}
      sources={[]}
      api={api}
      persons={[]}
      families={[]}
      facts={[]}
      places={[]}
      citations={[]}
      notes={[]}
      media={[]}
      mediaApi={mediaApi}
      onOpenPerson={vi.fn()}
      onOpenMedia={vi.fn()}
      onOpenSource={vi.fn()}
      onClose={vi.fn()}
      onCreated={overrides.onCreated ?? vi.fn()}
    />,
  );

  return { addSource };
}

describe('SourceTab', () => {
  it('saves a new source and reports the created id', async () => {
    const onCreated = vi.fn();
    const { addSource } = renderTab({ onCreated });

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));

    await waitFor(() => expect(addSource).toHaveBeenCalledTimes(1));
    expect(onCreated).toHaveBeenCalledWith(expect.any(String));
  });

  it('ignores a second save while the first is pending', async () => {
    let resolveSave!: () => void;
    const addSource = vi.fn(
      async () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const api = stubApi<SourceEditorApi>({
      addSource,
      getRepositories: async () => [],
      getTitles: async () => [],
    });
    const mediaApi = stubApi<MediaTargetApi>({ getMediaFor: async () => [], getAllMedia: async () => [] });
    renderUi(
      <SourceTab
        entityId="new:1"
        sources={[]}
        api={api}
        persons={[]}
        families={[]}
        facts={[]}
        places={[]}
        citations={[]}
        notes={[]}
        media={[]}
        mediaApi={mediaApi}
        onOpenPerson={vi.fn()}
        onOpenMedia={vi.fn()}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));
    await waitFor(() => expect(addSource).toHaveBeenCalledTimes(1));
    resolveSave();
  });

  it('shows a missing-source message for an unknown id', () => {
    renderTab({ entityId: 'missing' });
    expect(screen.getByText(nls.t('features.sources.notFound'))).toBeInTheDocument();
  });
});

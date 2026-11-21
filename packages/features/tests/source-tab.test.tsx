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

  it('keeps post-submission edits when an unrelated refresh arrives', async () => {
    let resolveSave!: () => void;
    const updateSource = vi.fn(
      async () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const api = stubApi<SourceEditorApi>({
      updateSource,
      getRepositories: async () => [],
      getTitles: async () => [],
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
    });
    const mediaApi = stubApi<MediaTargetApi>({ getMediaFor: async () => [], getAllMedia: async () => [] });
    const source = { id: 'S1', title: 'Old title', author: 'Alice' };
    const renderSource = (record: typeof source) =>
      renderUi(
        <SourceTab
          entityId="S1"
          sources={[record]}
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

    const view = renderSource(source);
    fireEvent.change(screen.getByDisplayValue('Old title'), { target: { value: 'New title' } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));
    await waitFor(() => expect(updateSource).toHaveBeenCalledTimes(1));

    // After Save, the user restores the previous title while a concurrent
    // author change arrives from another writer.
    fireEvent.change(screen.getByDisplayValue('New title'), { target: { value: 'Old title' } });
    view.rerender(
      <SourceTab
        entityId="S1"
        sources={[{ ...source, author: 'Bob' }]}
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
    expect(screen.getByDisplayValue('Old title')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bob')).toBeInTheDocument();
    resolveSave();
  });

  it('keeps the submitted draft when a stale refresh arrives before the save settles', async () => {
    let resolveSave!: () => void;
    const updateSource = vi.fn(
      async () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const api = stubApi<SourceEditorApi>({
      updateSource,
      getRepositories: async () => [],
      getTitles: async () => [],
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
    });
    const mediaApi = stubApi<MediaTargetApi>({ getMediaFor: async () => [], getAllMedia: async () => [] });
    const source = { id: 'S1', title: 'Old', author: 'Alice' };
    const props = (record: typeof source) => (
      <SourceTab
        entityId="S1"
        sources={[record]}
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
      />
    );
    const view = renderUi(props(source));
    fireEvent.change(screen.getByDisplayValue('Old'), { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));
    await waitFor(() => expect(updateSource).toHaveBeenCalledTimes(1));

    view.rerender(props({ ...source }));
    expect(screen.getByDisplayValue('New')).toBeInTheDocument();
    resolveSave();
  });

  it('lets successive refreshes advance untouched fields while a save is pending', async () => {
    let resolveSave!: () => void;
    const updateSource = vi.fn(
      async () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const api = stubApi<SourceEditorApi>({
      updateSource,
      getRepositories: async () => [],
      getTitles: async () => [],
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
    });
    const mediaApi = stubApi<MediaTargetApi>({ getMediaFor: async () => [], getAllMedia: async () => [] });
    const renderSource = (author: string) => (
      <SourceTab
        entityId="S1"
        sources={[{ id: 'S1', title: 'Old', author }]}
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
      />
    );
    const view = renderUi(renderSource('A'));
    fireEvent.change(screen.getByDisplayValue('Old'), { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));
    await waitFor(() => expect(updateSource).toHaveBeenCalledTimes(1));

    view.rerender(renderSource('B'));
    expect(screen.getByDisplayValue('B')).toBeInTheDocument();
    view.rerender(renderSource('C'));
    expect(screen.getByDisplayValue('C')).toBeInTheDocument();
    resolveSave();
  });

  it('shows a missing-source message for an unknown id', () => {
    renderTab({ entityId: 'missing' });
    expect(screen.getByText(nls.t('features.sources.notFound'))).toBeInTheDocument();
  });
});

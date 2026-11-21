import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MediaTab } from '@doru/features/media';
import type { MediaAdminApi } from '@doru/features/person';
import type { AttachmentsPanelApi } from '../src/attachments';
import type { MediaWithPath } from '@doru/ui/domain';
import { nls } from '../src/nls';
import { renderUi, stubApi } from '../../../test/ui/harness';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = () => done();
  });
  return { promise, resolve };
}

const targetData = {
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
  tasks: [],
};

function attachmentsStub(overrides: Partial<AttachmentsPanelApi> = {}): AttachmentsPanelApi {
  return stubApi<AttachmentsPanelApi>({
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
    ...overrides,
  });
}

const record: MediaWithPath = {
  id: 'M1',
  title: 'Old title',
  absolutePath: '',
  files: [],
  links: [{ id: 'L1', mediaId: 'M1', targetType: 'person', targetId: 'P1' }],
};

describe('MediaTab', () => {
  it('keeps a submitted draft while a pre-save refresh arrives', async () => {
    const pending = deferred();
    const updateMedia = vi.fn(async () => pending.promise);
    const api = stubApi<MediaAdminApi>({
      updateMedia,
      getMediaFor: async () => [],
      getAllMedia: async () => [],
    });
    const view = renderUi(
      <MediaTab
        entityId="M1"
        media={[{ id: 'M1', title: 'Old title', absolutePath: '', files: [] }]}
        api={api}
        attachmentsApi={attachmentsStub()}
        sources={[]}
        targetData={targetData}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('Old title'), { target: { value: 'New title' } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));
    await waitFor(() => expect(updateMedia).toHaveBeenCalledTimes(1));

    // A refresh that still carries the pre-save value must not reset the
    // draft while the write is pending.
    view.rerender(
      <MediaTab
        entityId="M1"
        media={[{ id: 'M1', title: 'Old title', absolutePath: '', files: [] }]}
        api={api}
        attachmentsApi={attachmentsStub()}
        sources={[]}
        targetData={targetData}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('New title')).toBeInTheDocument();

    await act(async () => pending.resolve());
    expect(screen.getByDisplayValue('New title')).toBeInTheDocument();
  });

  it('serializes overlapping saves instead of letting them race', async () => {
    const first = deferred();
    const second = deferred();
    const updateMedia = vi
      .fn()
      .mockImplementationOnce(async () => first.promise)
      .mockImplementationOnce(async () => second.promise);
    const api = stubApi<MediaAdminApi>({
      updateMedia,
      getMediaFor: async () => [],
      getAllMedia: async () => [],
    });
    renderUi(
      <MediaTab
        entityId="M1"
        media={[{ id: 'M1', title: 'Old title', absolutePath: '', files: [] }]}
        api={api}
        attachmentsApi={attachmentsStub()}
        sources={[]}
        targetData={targetData}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));
    await waitFor(() => expect(updateMedia).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByDisplayValue('Old title'), { target: { value: 'Second title' } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));
    expect(updateMedia).toHaveBeenCalledTimes(1);

    await act(async () => first.resolve());
    await waitFor(() => expect(updateMedia).toHaveBeenCalledTimes(2));
    await act(async () => second.resolve());
    expect(screen.getByDisplayValue('Second title')).toBeInTheDocument();
  });

  it('keeps post-submission edits when the save completion refreshes', async () => {
    const pending = deferred();
    const updateMedia = vi.fn(async () => pending.promise);
    const api = stubApi<MediaAdminApi>({
      updateMedia,
      getMediaFor: async () => [],
      getAllMedia: async () => [],
    });
    const media = (title: string, description: string) => [
      { id: 'M1', title, description, absolutePath: '', files: [] },
    ];
    const view = renderUi(
      <MediaTab
        entityId="M1"
        media={media('Old', 'X')}
        api={api}
        attachmentsApi={attachmentsStub()}
        sources={[]}
        targetData={targetData}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('Old'), { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));
    await waitFor(() => expect(updateMedia).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByDisplayValue('X'), { target: { value: 'Z' } });

    view.rerender(
      <MediaTab
        entityId="M1"
        media={media('New', 'Y')}
        api={api}
        attachmentsApi={attachmentsStub()}
        sources={[]}
        targetData={targetData}
        onClose={vi.fn()}
      />,
    );
    await act(async () => pending.resolve());
    expect(screen.getByDisplayValue('New')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Z')).toBeInTheDocument();
  });

  it('keeps a reversal across queued saves', async () => {
    const first = deferred();
    const second = deferred();
    const updateMedia = vi
      .fn()
      .mockImplementationOnce(async () => first.promise)
      .mockImplementationOnce(async () => second.promise);
    const api = stubApi<MediaAdminApi>({
      updateMedia,
      getMediaFor: async () => [],
      getAllMedia: async () => [],
    });
    renderUi(
      <MediaTab
        entityId="M1"
        media={[{ id: 'M1', title: 'A', absolutePath: '', files: [] }]}
        api={api}
        attachmentsApi={attachmentsStub()}
        sources={[]}
        targetData={targetData}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('A'), { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));
    await waitFor(() => expect(updateMedia).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByDisplayValue('B'), { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));
    await act(async () => first.resolve());
    await waitFor(() => expect(updateMedia).toHaveBeenCalledTimes(2));
    expect(updateMedia.mock.calls[1]?.[1]).toMatchObject({ title: 'A' });
    await act(async () => second.resolve());
  });

  it('opens a source from the media-link sources panel', async () => {
    const openSource = vi.fn();
    const api = stubApi<MediaAdminApi>({
      openSource,
      getMediaFor: async () => [],
      getAllMedia: async () => [],
    });
    const attachmentsApi = attachmentsStub({
      getCitations: async (targetType: string) =>
        targetType === 'media_link' ? [{ id: 'C1', sourceId: 'S1', targetType: 'media_link', targetId: 'L1' }] : [],
    });
    renderUi(
      <MediaTab
        entityId="M1"
        media={[record]}
        api={api}
        attachmentsApi={attachmentsApi}
        sources={[{ id: 'S1', title: 'Register' }]}
        targetData={targetData}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.media.linkSources') }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    expect(openSource).toHaveBeenCalledWith('S1');
  });
});

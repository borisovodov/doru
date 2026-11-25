import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { AutoSaveTabProvider, flushAutoSaves } from '@doru/ui';
import { MediaTab } from '@doru/features/media';
import type { MediaAdminApi } from '@doru/features/person';
import type { AttachmentsPanelApi } from '../src/attachments';
import type { MediaRecord } from '@doru/core';
import { TargetDirectoryProvider, type MediaWithPath } from '@doru/ui/domain';
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
    getIdentifiers: async () => [],
    getContacts: async () => [],
    getSubmitters: async () => [],
    getRecordSubmitters: async () => [],
    getMediaFor: async () => [],
    getAllMedia: async () => [],
    getTasksFor: async () => [],
    getAllTasks: async () => [],
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
  it('renders Related to after every attachment section', () => {
    const api = stubApi<MediaAdminApi>({
      getMediaFor: async () => [],
      getAllMedia: async () => [],
      attachMediaToTargets: async () => undefined,
    });
    renderUi(
      <MediaTab
        entityId="M1"
        media={[record]}
        api={api}
        attachmentsApi={attachmentsStub()}
        sources={[]}
        targetData={targetData}
        onClose={vi.fn()}
      />,
    );

    const regions = screen.getAllByRole('region');
    expect(regions[regions.length - 1]).toHaveAccessibleName(nls.t('features.tasks.target'));
  });

  it('gives the media record Tasks but a media link only Sources', async () => {
    const api = stubApi<MediaAdminApi>({
      getMediaFor: async () => [],
      getAllMedia: async () => [],
    });
    renderUi(
      <MediaTab
        entityId="M1"
        media={[record]}
        api={api}
        attachmentsApi={attachmentsStub()}
        sources={[]}
        targetData={targetData}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: nls.t('features.tasks.title') })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.media.linkSources') }));

    await waitFor(() =>
      expect(screen.getAllByRole('region', { name: nls.t('features.tree.sources.title') })).toHaveLength(2),
    );
    expect(screen.getAllByRole('region', { name: nls.t('features.tasks.title') })).toHaveLength(1);
    expect(screen.getAllByText(nls.t('features.tree.identifiers.title'))).toHaveLength(1);
    expect(screen.getAllByText(nls.t('features.tree.contributors.title'))).toHaveLength(1);
  });

  it('saves a file title on the registered close flush', async () => {
    const updateMedia = vi.fn(async (_before: MediaRecord, _after: MediaRecord) => undefined);
    const api = stubApi<MediaAdminApi>({
      updateMedia,
      getMediaFor: async () => [],
      getAllMedia: async () => [],
    });
    renderUi(
      <AutoSaveTabProvider tabId="media:M1">
        <MediaTab
          entityId="M1"
          media={[
            {
              id: 'M1',
              title: 'Media',
              absolutePath: '',
              files: [{ id: 'F1', path: 'a.jpg', absolutePath: '/tmp/a.jpg', title: 'Old file' }],
            },
          ]}
          api={api}
          attachmentsApi={attachmentsStub()}
          sources={[]}
          targetData={targetData}
          onClose={vi.fn()}
        />
      </AutoSaveTabProvider>,
    );

    fireEvent.change(screen.getByLabelText(nls.t('features.tree.media.fileTitle')), {
      target: { value: 'New file' },
    });
    await act(async () => {
      expect(await flushAutoSaves('media:M1')).toBe(true);
    });
    expect(updateMedia).toHaveBeenCalledTimes(1);
    const after = updateMedia.mock.calls[0]?.[1];
    expect(after?.files?.[0]).toMatchObject({ id: 'F1', title: 'New file' });

    fireEvent.change(screen.getByLabelText(nls.t('features.tree.media.fileTitle')), {
      target: { value: ' New file ' },
    });
    await act(async () => {
      expect(await flushAutoSaves('media:M1')).toBe(true);
    });
    expect(updateMedia).toHaveBeenCalledTimes(1);
  });

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
    fireEvent.blur(screen.getByDisplayValue('New title'), { relatedTarget: document.body });
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

    fireEvent.change(screen.getByDisplayValue('Old title'), { target: { value: 'First title' } });
    fireEvent.blur(screen.getByDisplayValue('First title'), { relatedTarget: document.body });
    await waitFor(() => expect(updateMedia).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByDisplayValue('First title'), { target: { value: 'Second title' } });
    fireEvent.blur(screen.getByDisplayValue('Second title'), { relatedTarget: document.body });
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
    fireEvent.blur(screen.getByDisplayValue('New'), { relatedTarget: document.body });
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

  it('saves a reversal made after a pre-write refresh', async () => {
    const pending = deferred();
    const updateMedia = vi
      .fn()
      .mockImplementationOnce(async () => pending.promise)
      .mockResolvedValueOnce(undefined);
    const api = stubApi<MediaAdminApi>({
      updateMedia,
      getMediaFor: async () => [],
      getAllMedia: async () => [],
    });
    const media = (title: string) => [{ id: 'M1', title, absolutePath: '', files: [] }];
    const view = renderUi(
      <MediaTab
        entityId="M1"
        media={media('Old')}
        api={api}
        attachmentsApi={attachmentsStub()}
        sources={[]}
        targetData={targetData}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('Old'), { target: { value: 'New' } });
    fireEvent.blur(screen.getByDisplayValue('New'), { relatedTarget: document.body });
    await waitFor(() => expect(updateMedia).toHaveBeenCalledTimes(1));

    // A refresh captured before the write must not become the dirty baseline.
    view.rerender(
      <MediaTab
        entityId="M1"
        media={media('Old')}
        api={api}
        attachmentsApi={attachmentsStub()}
        sources={[]}
        targetData={targetData}
        onClose={vi.fn()}
      />,
    );
    await act(async () => pending.resolve());
    expect(screen.getByDisplayValue('New')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('New'), { target: { value: 'Old' } });
    fireEvent.blur(screen.getByDisplayValue('Old'), { relatedTarget: document.body });
    await waitFor(() => expect(updateMedia).toHaveBeenCalledTimes(2));
    expect(updateMedia.mock.calls[1]?.[1]).toMatchObject({ title: 'Old' });
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
    fireEvent.blur(screen.getByDisplayValue('B'), { relatedTarget: document.body });
    await waitFor(() => expect(updateMedia).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByDisplayValue('B'), { target: { value: 'A' } });
    fireEvent.blur(screen.getByDisplayValue('A'), { relatedTarget: document.body });
    await act(async () => first.resolve());
    await waitFor(() => expect(updateMedia).toHaveBeenCalledTimes(2));
    expect(updateMedia.mock.calls[1]?.[1]).toMatchObject({ title: 'A' });
    await act(async () => second.resolve());
  });

  it('keeps targets selected while an attach request is pending', async () => {
    const pending = deferred();
    const attachMediaToTargets = vi.fn(async () => pending.promise);
    const api = stubApi<MediaAdminApi>({
      getMediaFor: async () => [],
      getAllMedia: async () => [],
      attachMediaToTargets,
    });
    renderUi(
      <TargetDirectoryProvider
        data={{
          ...targetData,
          places: [
            { id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }] },
            { id: 'PL2', names: [{ id: 'PN2', kind: 'official', position: 0, value: 'Kazan' }] },
          ],
        }}
      >
        <MediaTab
          entityId="M1"
          media={[{ id: 'M1', title: 'Photo', absolutePath: '', files: [] }]}
          api={api}
          attachmentsApi={attachmentsStub()}
          sources={[]}
          targetData={targetData}
          onClose={vi.fn()}
        />
      </TargetDirectoryProvider>,
    );

    const related = screen.getByRole('region', { name: nls.t('features.tasks.target') });
    fireEvent.focus(within(related).getByRole('combobox', { name: nls.t('features.tasks.target') }));
    fireEvent.click(screen.getByRole('option', { name: 'MoscowPlace' }));
    fireEvent.click(within(related).getByRole('button', { name: nls.t('features.tree.media.attach') }));
    await waitFor(() => expect(attachMediaToTargets).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('option', { name: 'KazanPlace' }));
    expect(screen.getAllByRole('button', { name: nls.t('features.targets.remove') })).toHaveLength(2);

    await act(async () => pending.resolve());
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: nls.t('features.targets.remove') })).toHaveLength(1),
    );
    expect(screen.getByText('Kazan')).toBeInTheDocument();
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

  it('keeps the picked targets and reports a failed attach', async () => {
    const attachMediaToTargets = vi.fn(async () => {
      throw new Error('disk full');
    });
    const api = stubApi<MediaAdminApi>({
      getMediaFor: async () => [],
      getAllMedia: async () => [],
      attachMediaToTargets,
    });
    renderUi(
      <TargetDirectoryProvider
        data={{
          ...targetData,
          places: [{ id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }] }],
        }}
      >
        <MediaTab
          entityId="M1"
          media={[{ id: 'M1', title: 'Photo', absolutePath: '', files: [] }]}
          api={api}
          attachmentsApi={attachmentsStub()}
          sources={[]}
          targetData={targetData}
          onClose={vi.fn()}
        />
      </TargetDirectoryProvider>,
    );

    const related = screen.getByRole('region', { name: nls.t('features.tasks.target') });
    fireEvent.focus(within(related).getByRole('combobox', { name: nls.t('features.tasks.target') }));
    fireEvent.click(screen.getByRole('option', { name: 'MoscowPlace' }));
    fireEvent.click(within(related).getByRole('button', { name: nls.t('features.tree.media.attach') }));

    await waitFor(() => expect(attachMediaToTargets).toHaveBeenCalledTimes(1));
    expect(attachMediaToTargets).toHaveBeenCalledWith('M1', [{ targetType: 'place', targetId: 'PL1' }]);
    expect(await screen.findByText(nls.t('features.tree.autosaveFailed'))).toBeInTheDocument();
    expect(within(related).getByRole('button', { name: nls.t('features.tree.media.attach') })).toBeEnabled();
  });
});

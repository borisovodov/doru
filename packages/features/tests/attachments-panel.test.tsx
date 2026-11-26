import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MediaSection, type MediaWithPath } from '@doru/ui/domain';
import type { MediaLinkRecord } from '@doru/core';
import { AttachmentsPanel, type AttachmentsPanelApi } from '../src/attachments';
import { nls } from '../src/nls';
import { renderUi, stubApi } from '../../../test/ui/harness';

function apiStub(overrides: Partial<AttachmentsPanelApi> = {}): AttachmentsPanelApi {
  return stubApi<AttachmentsPanelApi>({
    getNotes: async () => [],
    getCitations: async () => [],
    getContacts: async () => [],
    getSubmitters: async () => [],
    getRecordSubmitters: async () => [],
    getMediaFor: async () => [],
    getAllMedia: async () => [],
    getTasksFor: async () => [],
    getAllTasks: async () => [],
    attachSourceToTargets: async () => undefined,
    attachMediaToTargets: async () => undefined,
    ...overrides,
  });
}

function panel(targetType: string) {
  return <AttachmentsPanel targetType={targetType} targetId="X1" api={apiStub()} sources={[]} />;
}

function sectionVisible(title: string): boolean {
  return screen.queryByText(title) !== null;
}

describe('AttachmentsPanel target policy', () => {
  it('shows only notes on a task (media is feature-hidden)', () => {
    renderUi(panel('task'));

    expect(sectionVisible(nls.t('features.tree.notes.title'))).toBe(true);
    expect(sectionVisible(nls.t('features.tree.sources.title'))).toBe(false);
    expect(sectionVisible(nls.t('features.tree.contacts.title'))).toBe(false);
    expect(sectionVisible(nls.t('features.tree.contributors.title'))).toBe(false);
    expect(sectionVisible(nls.t('features.tasks.title'))).toBe(false);
  });

  it('shows only sources on a media link', () => {
    renderUi(panel('media_link'));

    expect(sectionVisible(nls.t('features.tree.sources.title'))).toBe(true);
    expect(sectionVisible(nls.t('features.tree.notes.title'))).toBe(false);
    expect(sectionVisible(nls.t('features.tree.notes.title'))).toBe(false);
    expect(sectionVisible(nls.t('features.tree.contacts.title'))).toBe(false);
    expect(sectionVisible(nls.t('features.tree.contributors.title'))).toBe(false);
    expect(sectionVisible(nls.t('features.tasks.title'))).toBe(false);
  });

  it('does not render a disallowed section even when the caller asks for it', () => {
    renderUi(
      <AttachmentsPanel
        targetType="media_link"
        targetId="ML1"
        api={apiStub()}
        sources={[]}
        sections={['notes', 'sources', 'media', 'tasks']}
      />,
    );

    expect(sectionVisible(nls.t('features.tree.sources.title'))).toBe(true);
    expect(sectionVisible(nls.t('features.tree.notes.title'))).toBe(false);
    expect(sectionVisible(nls.t('features.tasks.title'))).toBe(false);
  });

  it('hides tasks on a submitter but keeps contributors', () => {
    renderUi(panel('submitter'));

    expect(sectionVisible(nls.t('features.tree.contributors.title'))).toBe(true);
    expect(sectionVisible(nls.t('features.tasks.title'))).toBe(false);
  });

  it('shows tasks on a source', () => {
    renderUi(panel('source'));

    expect(sectionVisible(nls.t('features.tasks.title'))).toBe(true);
  });
});

describe('AttachmentsPanel contacts', () => {
  it('offers contacts on a target that can carry them', () => {
    renderUi(panel('fact'));

    expect(screen.getByText(nls.t('features.tree.contacts.title'))).toBeInTheDocument();
  });

  it('hides contacts on a target without a contact slot', () => {
    renderUi(panel('place'));

    expect(screen.queryByText(nls.t('features.tree.contacts.title'))).not.toBeInTheDocument();
  });

  it('keeps attachment forms scoped to the current target', () => {
    renderUi(panel('person'));

    expect(screen.queryByRole('combobox', { name: nls.t('features.tasks.target') })).not.toBeInTheDocument();
  });

  it('adds new sources only to the current target', async () => {
    const addSource = vi.fn(async () => undefined);
    renderUi(<AttachmentsPanel targetType="person" targetId="P1" api={apiStub({ addSource })} sources={[]} />);

    const sources = screen.getByRole('region', { name: nls.t('features.tree.sources.title') });
    fireEvent.change(within(sources).getByPlaceholderText(nls.t('features.tree.sources.titleField')), {
      target: { value: 'Book' },
    });
    fireEvent.click(within(sources).getByRole('button', { name: nls.t('features.tree.sources.add') }));
    await waitFor(() =>
      expect(addSource).toHaveBeenCalledWith(expect.objectContaining({ title: 'Book' }), 'person', 'P1'),
    );
  });

  it('adds new media only to the current target', async () => {
    const addMediaToTarget = vi.fn(async () => undefined);
    renderUi(
      <MediaSection
        targetType="person"
        targetId="P1"
        media={[]}
        api={{
          getMediaFor: async () => [],
          getAllMedia: async () => [],
          addMediaToTarget,
          attachMedia: async () => undefined,
          detachMedia: async () => undefined,
          deleteMedia: async () => undefined,
        }}
        refresh={async () => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.media.add') }));
    await waitFor(() => expect(addMediaToTarget).toHaveBeenCalledWith('person', 'P1'));
  });

  it('attaches existing media to the current target', async () => {
    const attachMedia = vi.fn(async () => undefined);
    const candidate = {
      id: 'M2',
      title: 'Portrait of Anna',
      absolutePath: '/demo/anna.jpg',
      files: [{ id: 'MF2', path: 'media/anna.jpg', absolutePath: '/demo/anna.jpg' }],
    };
    renderUi(
      <MediaSection
        targetType="person"
        targetId="P1"
        media={[]}
        api={{
          getMediaFor: async () => [],
          getAllMedia: async () => [candidate],
          addMediaToTarget: async () => undefined,
          attachMedia,
          detachMedia: async () => undefined,
          deleteMedia: async () => undefined,
        }}
        refresh={async () => undefined}
      />,
    );

    const select = await screen.findByRole('combobox', { name: nls.t('features.tree.media.attachExisting') });
    fireEvent.change(select, { target: { value: 'M2' } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.media.attach') }));

    await waitFor(() =>
      expect(attachMedia).toHaveBeenCalledWith(
        expect.objectContaining({ mediaId: 'M2', targetType: 'person', targetId: 'P1' }),
      ),
    );
  });

  it('detaches shared media and deletes it only from an explicit action', async () => {
    const ownerLink: MediaLinkRecord = { id: 'ML1', mediaId: 'M1', targetType: 'person', targetId: 'P1' };
    const otherLink: MediaLinkRecord = { id: 'ML2', mediaId: 'M1', targetType: 'place', targetId: 'PL1' };
    const item: MediaWithPath = {
      id: 'M1',
      title: 'Portrait of Anna',
      absolutePath: '/demo/anna.jpg',
      files: [{ id: 'MF1', path: 'media/anna.jpg', absolutePath: '/demo/anna.jpg' }],
      links: [ownerLink, otherLink],
    };
    const detachMedia = vi.fn(async () => undefined);
    const deleteMedia = vi.fn(async () => undefined);
    const refresh = vi.fn(async () => undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    try {
      renderUi(
        <MediaSection
          targetType="person"
          targetId="P1"
          media={[item]}
          api={{
            getMediaFor: async () => [item],
            getAllMedia: async () => [item],
            addMediaToTarget: async () => undefined,
            attachMedia: async () => undefined,
            detachMedia,
            deleteMedia,
          }}
          refresh={refresh}
        />,
      );

      fireEvent.click(await screen.findByRole('button', { name: nls.t('features.tree.media.detach') }));
      await waitFor(() => expect(detachMedia).toHaveBeenCalledWith(ownerLink));
      expect(deleteMedia).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.media.delete') }));
      await waitFor(() => expect(deleteMedia).toHaveBeenCalledWith(item));
      expect(confirm).toHaveBeenCalledWith(nls.t('features.tree.media.deleteConfirm'));
    } finally {
      confirm.mockRestore();
    }
  });

  it('offers only deletion for media linked to one record', async () => {
    const ownerLink: MediaLinkRecord = { id: 'ML1', mediaId: 'M1', targetType: 'person', targetId: 'P1' };
    const item: MediaWithPath = {
      id: 'M1',
      title: 'Portrait of Anna',
      absolutePath: '/demo/anna.jpg',
      files: [{ id: 'MF1', path: 'media/anna.jpg', absolutePath: '/demo/anna.jpg' }],
      links: [ownerLink],
    };
    renderUi(
      <MediaSection
        targetType="person"
        targetId="P1"
        media={[item]}
        api={{
          getMediaFor: async () => [item],
          getAllMedia: async () => [item],
          addMediaToTarget: async () => undefined,
          attachMedia: async () => undefined,
          detachMedia: async () => undefined,
          deleteMedia: async () => undefined,
        }}
        refresh={async () => undefined}
      />,
    );

    await screen.findByRole('button', { name: nls.t('features.tree.media.delete') });
    expect(screen.queryByRole('button', { name: nls.t('features.tree.media.detach') })).not.toBeInTheDocument();
  });
});

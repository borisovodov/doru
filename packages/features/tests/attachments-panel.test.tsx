import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MediaSection } from '@doru/ui/domain';
import { AttachmentsPanel, type AttachmentsPanelApi } from '../src/attachments';
import { nls } from '../src/nls';
import { renderUi, stubApi } from '../../../test/ui/harness';

function apiStub(overrides: Partial<AttachmentsPanelApi> = {}): AttachmentsPanelApi {
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
    attachSourceToTargets: async () => undefined,
    attachMediaToTargets: async () => undefined,
    ...overrides,
  });
}

function panel(targetType: string) {
  return <AttachmentsPanel targetType={targetType} targetId="X1" api={apiStub()} sources={[]} />;
}

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
});

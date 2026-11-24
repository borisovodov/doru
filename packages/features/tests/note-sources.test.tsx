import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { CitationRecord, NoteRecord, SourceRecord } from '@doru/core';
import { NoteSources } from '../src/attachments';
import type { AttachmentsApi } from '../src/person/types';
import { nls } from '../src/nls';
import { renderUi, stubApi } from '../../../test/ui/harness';

const note: NoteRecord = { id: 'N1', text: 'A note' };
const sources: SourceRecord[] = [{ id: 'S1', title: 'Book' }];
const citation: CitationRecord = { id: 'C1', sourceId: 'S1', targetType: 'note', targetId: 'N1' };

function apiStub(overrides: Partial<AttachmentsApi> = {}): AttachmentsApi {
  return stubApi<AttachmentsApi>({
    getCitations: async () => [],
    addSource: async () => undefined,
    ...overrides,
  });
}

describe('NoteSources', () => {
  it('lists the citations of a note and opens the cited source', async () => {
    const onOpenSource = vi.fn();
    renderUi(
      <NoteSources
        note={note}
        api={apiStub({ getCitations: async () => [citation] })}
        sources={sources}
        onOpenSource={onOpenSource}
      />,
    );

    const sourceButton = await screen.findByRole('button', { name: 'Book' });
    fireEvent.click(sourceButton);

    await waitFor(() => expect(onOpenSource).toHaveBeenCalledWith('S1'));
  });

  it('adds a new source to the note, not to its owner', async () => {
    const addSource = vi.fn(async () => undefined);
    renderUi(<NoteSources note={note} api={apiStub({ addSource })} sources={[]} />);

    const section = await screen.findByRole('region', { name: nls.t('features.tree.sources.title') });
    fireEvent.change(within(section).getByPlaceholderText(nls.t('features.tree.sources.titleField')), {
      target: { value: 'Book' },
    });
    fireEvent.click(within(section).getByRole('button', { name: nls.t('features.tree.sources.add') }));

    await waitFor(() =>
      expect(addSource).toHaveBeenCalledWith(expect.objectContaining({ title: 'Book' }), 'note', 'N1'),
    );
  });
});

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { FamilyRecord } from '@doru/core';
import { FamilyTab } from '@doru/features/family';
import type { FamilyEditorApi, MediaTargetApi } from '../src/person';
import { nls } from '../src/nls';
import { renderUi, stubApi } from '../../../test/ui/harness';

function apiStub(overrides: Partial<FamilyEditorApi> = {}): FamilyEditorApi {
  return stubApi<FamilyEditorApi>({
    getFacts: async () => [],
    getPlaces: async () => [],
    getAddresses: async () => [],
    getSubmitters: async () => [],
    getRecordSubmitters: async () => [],
    getNotes: async () => [],
    getAllNotes: async () => [],
    getCitations: async () => [],
    getTags: async () => [],
    getTagLinks: async () => [],
    getIdentifiers: async () => [],
    getContacts: async () => [],
    getRestrictions: async () => [],
    getMediaFor: async () => [],
    getAllMedia: async () => [],
    getTasksFor: async () => [],
    getSources: async () => [],
    ...overrides,
  });
}

const base: FamilyRecord = { id: 'F1', partners: [], children: [], unionKind: 'A', unionStatus: 'S0' };

describe('FamilyTab reconciliation', () => {
  it('adopts refreshed statuses while a changed field is pending', async () => {
    const updateFamily = vi.fn(() => new Promise<void>(() => undefined));
    const api = apiStub({ updateFamily });
    const mediaApi = stubApi<MediaTargetApi>({});
    const view = renderUi(
      <FamilyTab
        entityId="F1"
        families={[base]}
        api={api}
        persons={[]}
        associations={[]}
        sources={[]}
        media={[]}
        mediaApi={mediaApi}
        onOpenMedia={vi.fn()}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const kind = screen.getByLabelText(nls.t('features.tree.family.unionKind'));
    fireEvent.change(kind, { target: { value: 'B' } });
    fireEvent.blur(kind, { relatedTarget: document.body });
    await waitFor(() => expect(updateFamily).toHaveBeenCalledTimes(1));

    view.rerender(
      <FamilyTab
        entityId="F1"
        families={[{ ...base, unionStatus: 'S1' }]}
        api={api}
        persons={[]}
        associations={[]}
        sources={[]}
        media={[]}
        mediaApi={mediaApi}
        onOpenMedia={vi.fn()}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    view.rerender(
      <FamilyTab
        entityId="F1"
        families={[{ ...base, unionStatus: 'S2' }]}
        api={api}
        persons={[]}
        associations={[]}
        sources={[]}
        media={[]}
        mediaApi={mediaApi}
        onOpenMedia={vi.fn()}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(nls.t('features.tree.family.unionKind'))).toHaveValue('B');
    expect(screen.getByLabelText(nls.t('features.tree.family.unionStatus'))).toHaveValue('S2');
  });
});

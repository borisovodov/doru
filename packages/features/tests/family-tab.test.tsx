import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { FamilyRecord, PersonRecord } from '@doru/core';
import { FamilyTab } from '@doru/features/family';
import { emptyChildLinkDraft, emptyFamilyDraft } from '@doru/ui/domain';
import { mergeFamilyDraft } from '../src/family/FamilyTab';
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

const child: PersonRecord = { id: 'P1', sex: 'F', names: [{ id: 'N1', given: 'Ada' }], facts: [] };

describe('FamilyTab reconciliation', () => {
  it('merges child links row by row', () => {
    const baseDraft = emptyFamilyDraft();
    baseDraft.childLinks = [
      { ...emptyChildLinkDraft('P1'), id: 'C1', pedigree: 'birth' },
      { ...emptyChildLinkDraft('P2'), id: 'C2', status: 'A' },
    ];
    const current = {
      ...baseDraft,
      childLinks: baseDraft.childLinks.map((row) => (row.id === 'C1' ? { ...row, pedigree: 'adopted' } : row)),
    };
    const refreshed = {
      ...baseDraft,
      childLinks: baseDraft.childLinks.map((row) => (row.id === 'C2' ? { ...row, status: 'B' } : row)),
    };

    const merged = mergeFamilyDraft(current, baseDraft, refreshed);

    expect(merged.childLinks.find((row) => row.id === 'C1')?.pedigree).toBe('adopted');
    expect(merged.childLinks.find((row) => row.id === 'C2')?.status).toBe('B');
  });

  it('saves a child removal without waiting for a blur', async () => {
    const updateFamily = vi.fn(async (_before: FamilyRecord, _after: FamilyRecord) => undefined);
    const api = apiStub({ updateFamily });
    const mediaApi = stubApi<MediaTargetApi>({});
    const record: FamilyRecord = {
      ...base,
      children: ['P1'],
      childLinks: [{ id: 'C1', childId: 'P1' }],
    };
    renderUi(
      <FamilyTab
        entityId="F1"
        families={[record]}
        api={api}
        persons={[child]}
        associations={[]}
        sources={[]}
        media={[]}
        mediaApi={mediaApi}
        onOpenMedia={vi.fn()}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.family.removeMember') }));
    await waitFor(() => expect(updateFamily).toHaveBeenCalledTimes(1));
    const after = updateFamily.mock.calls[0]?.[1];
    expect(after?.childLinks).toEqual([]);
  });

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

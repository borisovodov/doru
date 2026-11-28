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
    getSubmitterLinks: async () => [],
    getNotes: async () => [],
    getCitations: async () => [],
    getContacts: async () => [],
    getMediaFor: async () => [],
    getAllMedia: async () => [],
    getTasksFor: async () => [],
    getAllTasks: async () => [],
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

  it('keeps refreshed order when links were not reordered locally', () => {
    const baseDraft = emptyFamilyDraft();
    baseDraft.childLinks = [
      { ...emptyChildLinkDraft('P1'), id: 'C1' },
      { ...emptyChildLinkDraft('P2'), id: 'C2' },
    ];
    const refreshed = {
      ...baseDraft,
      childLinks: [baseDraft.childLinks[1]!, baseDraft.childLinks[0]!],
    };

    const merged = mergeFamilyDraft(baseDraft, baseDraft, refreshed);

    expect(merged.childLinks.map((row) => row.id)).toEqual(['C2', 'C1']);
  });

  it('does not restore a pending link removed after submission', () => {
    const baseDraft = emptyFamilyDraft();
    baseDraft.childLinks = [{ ...emptyChildLinkDraft('P1'), id: 'C1' }];
    const pending = {
      ...baseDraft,
      childLinks: [...baseDraft.childLinks, { ...emptyChildLinkDraft('P2'), id: 'C2' }],
    };
    const current = { ...baseDraft };
    const refreshed = { ...baseDraft, unionStatus: 'S1', childLinks: pending.childLinks };

    const merged = mergeFamilyDraft(current, baseDraft, refreshed, pending, baseDraft);

    expect(merged.childLinks.map((row) => row.id)).toEqual(['C1']);
  });

  it('keeps a reverted reorder after the submission changed the order', () => {
    const baseDraft = emptyFamilyDraft();
    baseDraft.childLinks = [
      { ...emptyChildLinkDraft('P1'), id: 'C1' },
      { ...emptyChildLinkDraft('P2'), id: 'C2' },
    ];
    const pending = {
      ...baseDraft,
      childLinks: [baseDraft.childLinks[1]!, baseDraft.childLinks[0]!],
    };
    const current = { ...baseDraft };
    const refreshed = { ...baseDraft, unionStatus: 'S1', childLinks: pending.childLinks };

    const merged = mergeFamilyDraft(current, baseDraft, refreshed, pending, baseDraft);

    expect(merged.childLinks.map((row) => row.id)).toEqual(['C1', 'C2']);
  });

  it('keeps a locally added row in its chosen position', () => {
    const baseDraft = emptyFamilyDraft();
    baseDraft.childLinks = [
      { ...emptyChildLinkDraft('P1'), id: 'C1' },
      { ...emptyChildLinkDraft('P2'), id: 'C2' },
    ];
    const added = { ...emptyChildLinkDraft('P3'), id: 'C3' };
    const current = { ...baseDraft, childLinks: [added, ...baseDraft.childLinks] };

    const merged = mergeFamilyDraft(current, baseDraft, baseDraft);

    expect(merged.childLinks.map((row) => row.id)).toEqual(['C3', 'C1', 'C2']);
  });

  it('merges a synthesized child link with its explicit refreshed row', () => {
    const baseDraft = emptyFamilyDraft();
    baseDraft.childLinks = [{ ...emptyChildLinkDraft('P1'), id: 'F1#child#P1' }];
    const current = {
      ...baseDraft,
      childLinks: [{ ...baseDraft.childLinks[0]!, status: 'adopted' }],
    };
    const refreshed = {
      ...baseDraft,
      childLinks: [{ ...baseDraft.childLinks[0]!, id: 'C1', status: 'birth' }],
    };

    const merged = mergeFamilyDraft(current, baseDraft, refreshed);

    expect(merged.childLinks).toHaveLength(1);
    expect(merged.childLinks[0]).toMatchObject({ id: 'C1', childId: 'P1', status: 'adopted' });
  });

  it('adopts refreshed scalar values after a whitespace-only edit', () => {
    const baseDraft = emptyFamilyDraft();
    baseDraft.unionKind = 'A';
    const current = { ...baseDraft, unionKind: ' A ' };
    const refreshed = { ...baseDraft, unionKind: 'B' };

    const merged = mergeFamilyDraft(current, baseDraft, refreshed);

    expect(merged.unionKind).toBe('B');
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

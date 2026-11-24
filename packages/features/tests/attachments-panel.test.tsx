import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { AttachmentsPanel, type AttachmentsPanelApi } from '../src/attachments';
import { nls } from '../src/nls';
import { renderUi, stubApi } from '../../../test/ui/harness';

function apiStub(): AttachmentsPanelApi {
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
    addSourceToTargets: async () => undefined,
    attachSourceToTargets: async () => undefined,
    addMediaToTargets: async () => undefined,
    attachMediaToTargets: async () => undefined,
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
});

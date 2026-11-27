import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { SubmitterTab } from '@doru/features/registries';
import type { MediaTargetApi, RegistriesEditorApi } from '../src/person';
import type { TaskTargetData } from '@doru/ui/domain';
import { nls } from '../src/nls';
import { renderUi, stubApi } from '../../../test/ui/harness';

const targetData: TaskTargetData = {
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

function apiStub(): RegistriesEditorApi {
  return stubApi<RegistriesEditorApi>({
    getNotes: async () => [],
    getCitations: async () => [],
    getContacts: async () => [],
    getSubmitters: async () => [],
    getRecordSubmitters: async () => [],
    getMediaFor: async () => [],
    getAllMedia: async () => [],
    getRepositories: async () => [],
    getAddress: async () => undefined,
  });
}

function mediaApiStub(): MediaTargetApi {
  return stubApi<MediaTargetApi>({
    getMediaFor: async () => [],
    getAllMedia: async () => [],
  });
}

describe('SubmitterTab', () => {
  it('does not render Tasks or Contributors sections', () => {
    renderUi(
      <SubmitterTab
        entityId="SU1"
        submitters={[{ id: 'SU1', name: 'Ivan Petrov' }]}
        addresses={[]}
        api={apiStub()}
        sources={[]}
        media={[]}
        mediaApi={mediaApiStub()}
        recordSubmitters={[]}
        targetData={targetData}
        onOpenSource={vi.fn()}
        onOpenMedia={vi.fn()}
        onOpenAddress={vi.fn()}
        onOpenTarget={vi.fn()}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    expect(screen.queryByText(nls.t('features.tasks.title'))).not.toBeInTheDocument();
    expect(screen.queryByText(nls.t('features.tree.contributors.title'))).not.toBeInTheDocument();
    expect(screen.getByText(nls.t('features.tree.submitter.referencedBy'))).toBeInTheDocument();
  });
});

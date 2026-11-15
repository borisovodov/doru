import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { emptyFamilyDraft } from '@doru/ui/domain';
import type { PersonRecord } from '@doru/core';
import { FamilyEditor } from '@doru/features';
import type { FamilyEditorApi } from '@doru/features';
import { nls } from '../src/nls';
import { renderUi, stubApi } from '../../../test/ui/harness';

const ada: PersonRecord = {
  id: 'person-ada',
  sex: 'F',
  names: [{ id: 'name-ada', given: 'Ada', surname: 'Lovelace' }],
  facts: [],
};

const grace: PersonRecord = {
  id: 'person-grace',
  sex: 'F',
  names: [{ id: 'name-grace', given: 'Grace', surname: 'Hopper' }],
  facts: [],
};

async function renderEditor(overrides: { onSave?: () => void; onDelete?: () => void } = {}) {
  const draft = emptyFamilyDraft();
  const onChange = vi.fn();
  const api = stubApi<FamilyEditorApi>({
    getFacts: async () => [],
    getPlaces: async () => [],
    getAddresses: async () => [],
    getSubmitters: async () => [],
    getRecordSubmitters: async () => [],
  });

  renderUi(
    <FamilyEditor
      draft={draft}
      onChange={onChange}
      persons={[ada, grace]}
      families={[]}
      associations={[]}
      sources={[]}
      api={api}
      onSave={overrides.onSave ?? vi.fn()}
      onDelete={overrides.onDelete}
    />,
  );

  await act(async () => {});
  return { draft, onChange };
}

describe('FamilyEditor', () => {
  it('adds a partner and a child from the candidate lists', async () => {
    const { onChange } = await renderEditor();
    const selects = screen.getAllByRole('combobox');

    fireEvent.change(selects[0]!, { target: { value: ada.id } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.families.addPartner') }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ partnerLinks: [expect.objectContaining({ personId: ada.id })] }),
    );

    fireEvent.change(selects[1]!, { target: { value: grace.id } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.families.addChild') }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ childLinks: [expect.objectContaining({ childId: grace.id })] }),
    );
  });

  it('reports family details and the header actions', async () => {
    const onSave = vi.fn();
    const onDelete = vi.fn();
    const { onChange } = await renderEditor({ onSave, onDelete });

    expect(screen.getByLabelText(nls.t('features.tree.families.title'))).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(nls.t('features.tree.family.unionKind')), {
      target: { value: 'civil' },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ unionKind: 'civil' }));

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));
    expect(onSave).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.fact.delete') }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

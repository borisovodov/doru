import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { newPersonDraft } from '@doru/ui/domain';
import { PersonEditor, type MediaTargetApi, type PersonEditorApi } from '@doru/features';
import { nls } from '../src/nls';
import { renderUi, stubApi } from '../../../test/ui/harness';

function renderEditor(overrides: { onSave?: () => void; onCancel?: () => void; onDelete?: () => void } = {}) {
  const draft = newPersonDraft();
  const onChange = vi.fn();
  const api = stubApi<PersonEditorApi>({
    getFamilies: async () => [],
    getPlaces: async () => [],
    getAddresses: async () => [],
    getTags: async () => [],
  });
  const mediaApi = stubApi<MediaTargetApi>({
    getMediaFor: async () => [],
    getAllMedia: async () => [],
  });

  renderUi(
    <PersonEditor
      draft={draft}
      persons={[]}
      onChange={onChange}
      onSave={overrides.onSave ?? vi.fn()}
      onCancel={overrides.onCancel}
      onDelete={overrides.onDelete}
      api={api}
      mediaApi={mediaApi}
    />,
  );

  return { draft, onChange };
}

describe('PersonEditor', () => {
  it('renders a new person and wires the header actions', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const onDelete = vi.fn();
    renderEditor({ onSave, onCancel, onDelete });

    expect(screen.getByLabelText(nls.t('features.personEditor.title'))).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: nls.t('features.tree.names.title') })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));
    expect(onSave).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.back') }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.fact.delete') }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('reports a changed sex through onChange', () => {
    const { onChange } = renderEditor();

    fireEvent.change(screen.getByLabelText(nls.t('features.tree.field.sex')), { target: { value: 'F' } });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sex: 'F' }));
  });
});

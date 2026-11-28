import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { emptySourceDraft } from '@doru/ui/domain';
import { SourceEditor } from '@doru/features';
import { nls } from '../src/nls';
import { renderUi } from '../../../test/ui/harness';

function renderEditor(overrides: { onSave?: () => void; onCancel?: () => void } = {}) {
  const draft = emptySourceDraft();
  const onChange = vi.fn();

  renderUi(
    <SourceEditor
      draft={draft}
      isNew
      onChange={onChange}
      repositories={[]}
      titles={[]}
      places={[]}
      onAddRepository={async () => {}}
      onSave={overrides.onSave ?? vi.fn()}
      onCancel={overrides.onCancel}
    />,
  );

  return { draft, onChange };
}

describe('SourceEditor', () => {
  it('renders the bibliographic fields and the header actions', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    renderEditor({ onSave, onCancel });

    expect(screen.getByLabelText(nls.t('features.tree.sources.title'))).toBeInTheDocument();
    expect(screen.getByLabelText(nls.t('features.tree.sources.titleField'))).toBeInTheDocument();
    for (const label of [
      nls.t('features.tree.source.publication'),
      nls.t('features.tree.source.bibliography'),
      nls.t('features.tree.source.dataNote'),
      nls.t('features.tree.source.subsequentCitationFormat'),
    ]) {
      expect(screen.getByLabelText(label).tagName).toBe('TEXTAREA');
    }

    fireEvent.click(screen.getAllByRole('button', { name: nls.t('features.tree.create') })[0]!);
    expect(onSave).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.back') }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('reports field edits through onChange', () => {
    const { onChange } = renderEditor();

    fireEvent.change(screen.getByLabelText(nls.t('features.tree.sources.titleField')), {
      target: { value: 'Parish register' },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ title: 'Parish register' }));

    fireEvent.change(screen.getByLabelText(nls.t('features.tree.sources.authorField')), {
      target: { value: 'St Mary' },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ author: 'St Mary' }));
  });

  it('edits the source text, data events and repository copies', () => {
    const { onChange } = renderEditor();

    fireEvent.change(screen.getByRole('textbox', { name: nls.t('features.tree.source.texts') }), {
      target: { value: 'entry 14' },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ text: 'entry 14' }));

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.source.dataEvents.add') }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dataEvents: [expect.any(Object)] }));

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.source.repositories.add') }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ repositories: [expect.any(Object)] }));
  });
});

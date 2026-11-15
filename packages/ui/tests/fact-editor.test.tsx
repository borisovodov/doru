import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { emptyFactDraft, factDraftToRecord } from '@doru/ui/domain';
import { FactEditor } from '@doru/ui/domain';
import { nls } from '../src/nls';
import { renderUi } from '../../../test/ui/harness';

function makeFact() {
  const record = factDraftToRecord(emptyFactDraft({ personId: 'person-1' }));
  return { ...record, tag: 'BIRT' };
}

describe('FactEditor', () => {
  it('saves the edited value and cancels without saving', async () => {
    const fact = makeFact();
    const onSave = vi.fn(async () => {});
    const onCancel = vi.fn();
    renderUi(
      <FactEditor
        fact={fact}
        persons={[]}
        families={[]}
        places={[]}
        addresses={[]}
        onSave={onSave}
        onCancel={onCancel}
        onDelete={vi.fn(async () => {})}
      />,
    );

    fireEvent.change(screen.getByLabelText(nls.t('features.tree.fact.value')), {
      target: { value: '1850 census' },
    });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: fact.id, value: '1850 census' }));

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.fact.cancel') }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('uppercases the event tag and keeps the fact owner', async () => {
    const fact = makeFact();
    const onSave = vi.fn(async () => {});
    renderUi(
      <FactEditor
        fact={fact}
        persons={[]}
        families={[]}
        places={[]}
        addresses={[]}
        onSave={onSave}
        onCancel={vi.fn()}
        onDelete={vi.fn(async () => {})}
      />,
    );

    fireEvent.change(screen.getByLabelText(nls.t('features.tree.events.typeField')), {
      target: { value: 'deat' },
    });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ tag: 'DEAT', personId: fact.personId, familyId: undefined }),
    );
  });

  it('deletes the fact through the callback', async () => {
    const fact = makeFact();
    const onDelete = vi.fn(async () => {});
    renderUi(
      <FactEditor
        fact={fact}
        persons={[]}
        families={[]}
        places={[]}
        addresses={[]}
        onSave={vi.fn(async () => {})}
        onCancel={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.fact.delete') }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(fact));
  });
});

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { NoteRecord } from '@doru/core';
import { NotesSection } from '../src/domain/notes/NotesSection';
import { nls } from '../src/nls';
import { renderUi } from '../../../test/ui/harness';

const existingNote: NoteRecord = { id: 'N2', text: 'Existing note' };

const noop = async () => undefined;

describe('NotesSection', () => {
  it('attaches an existing note and clears the selection', async () => {
    const onAttach = vi.fn(async () => undefined);
    renderUi(
      <NotesSection
        targetType="person"
        targetId="P1"
        notes={[]}
        availableNotes={[existingNote]}
        onAdd={noop}
        onUpdate={noop}
        onAttach={onAttach}
        onDelete={noop}
      />,
    );

    const select = screen.getByRole('combobox', { name: nls.t('features.tree.notes.attachExisting') });
    fireEvent.change(select, { target: { value: 'N2' } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.notes.attach') }));

    await waitFor(() => expect(onAttach).toHaveBeenCalledWith('N2'));
    expect(select).toHaveValue('');
  });

  it('edits a shared note for every linked record without a split option', async () => {
    const shared: NoteRecord = {
      id: 'N1',
      text: 'Shared note text',
      links: [
        { id: 'NL1', targetType: 'person', targetId: 'P1' },
        { id: 'NL2', targetType: 'place', targetId: 'PL1' },
      ],
    };
    const onUpdate = vi.fn(async () => undefined);
    renderUi(
      <NotesSection
        targetType="person"
        targetId="P1"
        notes={[shared]}
        onAdd={noop}
        onUpdate={onUpdate}
        onDelete={noop}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.notes.edit') }));
    fireEvent.change(screen.getByDisplayValue(shared.text), { target: { value: 'Updated shared text' } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(shared, expect.objectContaining({ text: 'Updated shared text' })),
    );
  });

  it('adds a note from the button, not on Enter', async () => {
    const onAdd = vi.fn(async () => undefined);
    renderUi(
      <NotesSection targetType="person" targetId="P1" notes={[]} onAdd={onAdd} onUpdate={noop} onDelete={noop} />,
    );

    const field = screen.getByPlaceholderText(nls.t('features.tree.notes.placeholder'));
    expect(field.tagName).toBe('TEXTAREA');
    fireEvent.change(field, { target: { value: 'First line\nSecond line' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.notes.add') }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('First line\nSecond line'));
  });

  it('reports a failed attach', async () => {
    renderUi(
      <NotesSection
        targetType="person"
        targetId="P1"
        notes={[]}
        availableNotes={[existingNote]}
        onAdd={noop}
        onUpdate={noop}
        onAttach={async () => {
          throw new Error('disk full');
        }}
        onDelete={noop}
      />,
    );

    const select = screen.getByRole('combobox', { name: nls.t('features.tree.notes.attachExisting') });
    fireEvent.change(select, { target: { value: 'N2' } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.notes.attach') }));

    expect(await screen.findByText(nls.t('features.tree.autosaveFailed'))).toBeInTheDocument();
    expect(select).toHaveValue('N2');
  });
});

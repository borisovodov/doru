import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { NoteRecord } from '@doru/core';
import { NotesSection } from '../src/domain/notes/NotesSection';
import { nls } from '../src/nls';
import { renderUi } from '../../../test/ui/harness';

const note: NoteRecord = {
  id: 'N1',
  text: 'Existing note',
  targetType: 'person',
  targetId: 'P1',
};

const noop = async () => undefined;

describe('NotesSection', () => {
  it('edits the note through the update callback', async () => {
    const onUpdate = vi.fn(async () => undefined);
    renderUi(<NotesSection notes={[note]} onAdd={noop} onUpdate={onUpdate} onDelete={noop} />);

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.notes.edit') }));
    fireEvent.change(screen.getByDisplayValue(note.text), { target: { value: 'Updated note' } });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.save') }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(note, expect.objectContaining({ text: 'Updated note' })));
  });

  it('deletes the note through the delete callback', async () => {
    const onDelete = vi.fn(async () => undefined);
    renderUi(<NotesSection notes={[note]} onAdd={noop} onUpdate={noop} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.notes.remove') }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(note));
  });

  it('adds a note from the button, not on Enter', async () => {
    const onAdd = vi.fn(async () => undefined);
    renderUi(<NotesSection notes={[]} onAdd={onAdd} onUpdate={noop} onDelete={noop} />);

    const field = screen.getByPlaceholderText(nls.t('features.tree.notes.placeholder'));
    expect(field.tagName).toBe('TEXTAREA');
    fireEvent.change(field, { target: { value: 'First line\nSecond line' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.notes.add') }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('First line\nSecond line'));
  });
});

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

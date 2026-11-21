import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { CitationsList, NotesList, TagsList } from '../src/sidebar/RegistryLists';
import { nls } from '../src/nls';
import { renderUi } from '../../../test/ui/harness';
import type { TaskTargetData } from '@doru/ui/domain';

const targetData: TaskTargetData = {
  persons: [{ id: 'P1', sex: 'U', names: [{ id: 'N1', given: 'Ivan', surname: 'Petrov' }], facts: [] }],
  families: [],
  sources: [{ id: 'S1', title: 'Parish register' }],
  places: [],
  repositories: [],
  titles: [],
  facts: [],
  citations: [],
  notes: [],
  media: [],
  submitters: [],
  addresses: [],
  associations: [],
  tasks: [],
};

describe('registry sidebar lists', () => {
  it('shows orphaned tags and deletes them from the global list', () => {
    const onDeleteTag = vi.fn();
    renderUi(
      <TagsList
        tags={[
          { id: 'TAG1', name: 'Used' },
          { id: 'TAG2', name: 'Orphan' },
        ]}
        tagLinks={[{ id: 'L1', tagId: 'TAG1', targetType: 'person', targetId: 'P1' }]}
        onDeleteTag={onDeleteTag}
      />,
    );

    const orphanRow = screen.getByText('Orphan').closest('li');
    expect(orphanRow).not.toBeNull();
    expect(within(orphanRow!).getByText(nls.t('features.tree.tags.orphan'))).toBeInTheDocument();
    fireEvent.click(within(orphanRow!).getByRole('button', { name: nls.t('features.tree.tags.delete') }));
    expect(onDeleteTag).toHaveBeenCalledWith({ id: 'TAG2', name: 'Orphan' });
  });

  it('lists every note with its target record', () => {
    renderUi(
      <NotesList
        notes={[{ id: 'N1', text: 'A note', targetType: 'person', targetId: 'P1' }]}
        targetData={targetData}
      />,
    );
    expect(screen.getAllByText('A note').length).toBeGreaterThan(0);
    expect(screen.getByText('Ivan Petrov')).toBeInTheDocument();
  });

  it('shows every linked target of a shared note', () => {
    renderUi(
      <NotesList
        notes={[
          {
            id: 'N1',
            text: 'Shared note',
            links: [
              { id: 'L1', targetType: 'person', targetId: 'P1' },
              { id: 'L2', targetType: 'person', targetId: 'P2' },
            ],
          },
        ]}
        targetData={{
          ...targetData,
          persons: [...targetData.persons, { id: 'P2', sex: 'U', names: [{ id: 'N2', given: 'Maria' }], facts: [] }],
        }}
      />,
    );
    expect(screen.getByText(/Ivan Petrov/)).toBeInTheDocument();
    expect(screen.getByText(/Maria/)).toBeInTheDocument();
  });

  it('expands the full note text from the global note list', () => {
    renderUi(
      <NotesList
        notes={[
          { id: 'N1', text: 'A very long note that needs the full text view', targetType: 'person', targetId: 'P1' },
        ]}
        targetData={targetData}
      />,
    );
    const summary = screen.getByText(nls.t('features.tree.notes.showFull'));
    const details = summary.closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(summary);
    expect(details).toHaveAttribute('open');
  });

  it('opens the cited source from the global citation list', () => {
    const onOpenSource = vi.fn();
    renderUi(
      <CitationsList
        citations={[{ id: 'C1', sourceId: 'S1', targetType: 'person', targetId: 'P1', page: 'p. 1' }]}
        sources={[{ id: 'S1', title: 'Parish register' }]}
        targetData={targetData}
        onOpenSource={onOpenSource}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Parish register/ }));
    expect(onOpenSource).toHaveBeenCalledWith('S1');
  });
});

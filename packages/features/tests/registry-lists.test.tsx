import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
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
  todos: [],
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

    expect(screen.getByText(nls.t('features.tree.tags.orphan'))).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: nls.t('features.tree.tags.delete') })[1]!);
    expect(onDeleteTag).toHaveBeenCalledWith({ id: 'TAG2', name: 'Orphan' });
  });

  it('lists every note with its target record', () => {
    renderUi(
      <NotesList
        notes={[{ id: 'N1', text: 'A note', targetType: 'person', targetId: 'P1' }]}
        targetData={targetData}
      />,
    );
    expect(screen.getByText('A note')).toBeInTheDocument();
    expect(screen.getByText('Ivan Petrov')).toBeInTheDocument();
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

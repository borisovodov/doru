import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import type { CitationRecord, PersonRecord, PlaceRecord, SourceRecord } from '@doru/core';
import { SourceCitationsList } from '@doru/features';
import { TargetDirectoryProvider, type TaskTargetData } from '@doru/ui/domain';
import { renderUi } from '../../../test/ui/harness';

const source: SourceRecord = { id: 'S1', title: 'Parish register' };

const person: PersonRecord = {
  id: 'P1',
  names: [{ id: 'N1', given: 'Ivan', surname: 'Petrov' }],
  sex: 'M',
  facts: [],
};

const place: PlaceRecord = {
  id: 'PL1',
  names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }],
};

const data: TaskTargetData = {
  persons: [person],
  families: [],
  sources: [source],
  places: [place],
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

describe('SourceCitationsList', () => {
  it('labels citations by the target record instead of its id', () => {
    const citations: CitationRecord[] = [
      { id: 'C1', sourceId: 'S1', targetType: 'person', targetId: 'P1' },
      { id: 'C2', sourceId: 'S1', targetType: 'place', targetId: 'PL1' },
    ];

    renderUi(
      <TargetDirectoryProvider data={data}>
        <SourceCitationsList
          source={source}
          persons={[person]}
          families={[]}
          facts={[]}
          citations={citations}
          notes={[]}
          onOpenPerson={vi.fn()}
        />
      </TargetDirectoryProvider>,
    );

    expect(screen.getByText('Ivan Petrov')).toBeInTheDocument();
    expect(screen.getByText('Moscow')).toBeInTheDocument();
    expect(screen.queryByText('PL1')).not.toBeInTheDocument();
  });
});

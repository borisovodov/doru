import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { TargetRef } from '@doru/core/model';
import { TargetDirectoryProvider, TargetPicker } from '../src/domain/targets';
import type { TargetData } from '../src/domain/task/taskTargets';
import { renderUi } from '../../../test/ui/harness';

const data: TargetData = {
  persons: [
    { id: 'P1', names: [{ id: 'N1', given: 'Ivan', surname: 'Petrov' }], sex: 'M', facts: [] },
    { id: 'P2', names: [{ id: 'N2', given: 'Anna', surname: 'Petrova' }], sex: 'F', facts: [] },
  ],
  families: [],
  sources: [],
  places: [{ id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }] }],
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

function Picker() {
  const [value, setValue] = useState<TargetRef[]>([]);
  return <TargetPicker allowedTypes={['person', 'place']} value={value} onChange={setValue} />;
}

describe('TargetPicker', () => {
  it('offers every allowed record without a type selector', () => {
    renderUi(
      <TargetDirectoryProvider data={data}>
        <Picker />
      </TargetDirectoryProvider>,
    );

    fireEvent.focus(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: /Ivan Petrov/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Moscow/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: /Ivan Petrov/ }));
    expect(screen.getByText('Ivan Petrov')).toBeInTheDocument();
  });

  it('filters by the display label and adds several targets as chips', () => {
    renderUi(
      <TargetDirectoryProvider data={data}>
        <Picker />
      </TargetDirectoryProvider>,
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'moscow' } });
    fireEvent.click(screen.getByRole('option', { name: /Moscow/ }));
    expect(screen.getByText('Moscow')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'anna' } });
    fireEvent.click(screen.getByRole('option', { name: /Anna Petrova/ }));
    expect(screen.getByText('Moscow')).toBeInTheDocument();
    expect(screen.getByText('Anna Petrova')).toBeInTheDocument();
  });
});

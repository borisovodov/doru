import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { AttachExisting } from '../src/patterns/attach-existing/AttachExisting';
import { renderUi } from '../../../test/ui/harness';

const options = [
  { id: 'N1', label: 'First note' },
  { id: 'N2', label: 'Second note' },
];

describe('AttachExisting', () => {
  it('attaches the selected record and clears the selection', async () => {
    const onAttach = vi.fn(async () => undefined);
    renderUi(
      <AttachExisting label="Attach an existing note" actionLabel="Attach" options={options} onAttach={onAttach} />,
    );

    const select = screen.getByRole('combobox', { name: 'Attach an existing note' });
    fireEvent.change(select, { target: { value: 'N2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Attach' }));

    await waitFor(() => expect(onAttach).toHaveBeenCalledWith('N2'));
    expect(select).toHaveValue('');
  });

  it('reports a failed attach and keeps the record selected', async () => {
    const onAttach = vi.fn(async () => {
      throw new Error('disk full');
    });
    const onError = vi.fn();
    renderUi(
      <AttachExisting
        label="Attach an existing note"
        actionLabel="Attach"
        options={options}
        onAttach={onAttach}
        onError={onError}
      />,
    );

    const select = screen.getByRole('combobox', { name: 'Attach an existing note' });
    fireEvent.change(select, { target: { value: 'N2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Attach' }));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(select).toHaveValue('N2');
  });

  it('clears a selection that is no longer a candidate', () => {
    const onAttach = vi.fn(async () => undefined);
    const { rerender } = renderUi(
      <AttachExisting label="Attach an existing note" actionLabel="Attach" options={options} onAttach={onAttach} />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Attach an existing note' }), {
      target: { value: 'N2' },
    });
    rerender(
      <AttachExisting
        label="Attach an existing note"
        actionLabel="Attach"
        options={options.slice(0, 1)}
        onAttach={onAttach}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Attach an existing note' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Attach' })).toBeDisabled();
  });

  it('keeps the button disabled until a record is selected', () => {
    renderUi(
      <AttachExisting label="Attach an existing note" actionLabel="Attach" options={options} onAttach={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Attach' })).toBeDisabled();
  });

  it('renders nothing when there are no candidates', () => {
    const { container } = renderUi(
      <AttachExisting label="Attach an existing note" actionLabel="Attach" options={[]} onAttach={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

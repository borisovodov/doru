import { createRef } from 'react';
import { Pencil } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { IconButton } from '../src/atoms/icon-button/IconButton';
import { renderUi } from '../../../test/ui/harness';

afterEach(() => {
  vi.useRealTimers();
});

function showTooltip(button: HTMLElement): void {
  fireEvent.mouseEnter(button);
  act(() => {
    vi.advanceTimersByTime(600);
  });
}

describe('IconButton tooltip', () => {
  it('shows the required label as the tooltip and links it to the button', () => {
    vi.useFakeTimers();
    renderUi(<IconButton label="Edit person" icon={<Pencil aria-hidden="true" />} />);

    const button = screen.getByRole('button', { name: 'Edit person' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.mouseEnter(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Edit person');
    expect(button).toHaveAttribute('aria-describedby', tooltip.id);

    fireEvent.mouseLeave(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(button).not.toHaveAttribute('aria-describedby');
  });

  it('opens on keyboard focus and closes on blur or Escape', () => {
    vi.useFakeTimers();
    renderUi(<IconButton label="Delete person" icon={<Pencil aria-hidden="true" />} />);

    const button = screen.getByRole('button', { name: 'Delete person' });

    fireEvent.focus(button);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Delete person');

    fireEvent.blur(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    showTooltip(button);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.keyDown(button, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders the optional shortcut next to the tooltip text', () => {
    vi.useFakeTimers();
    renderUi(<IconButton label="Edit person" shortcut="⌘E" icon={<Pencil aria-hidden="true" />} />);

    showTooltip(screen.getByRole('button', { name: 'Edit person' }));

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Edit person');
    expect(tooltip).toHaveTextContent('⌘E');
    expect(tooltip.querySelector('kbd')).not.toBeNull();
  });

  it('opens for a disabled button on pointer hover', () => {
    vi.useFakeTimers();
    renderUi(<IconButton label="Edit person" icon={<Pencil aria-hidden="true" />} disabled />);

    const button = screen.getByRole('button', { name: 'Edit person' });
    fireEvent.pointerEnter(button);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Edit person');

    fireEvent.pointerLeave(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps only one tooltip open at a time', () => {
    vi.useFakeTimers();
    renderUi(
      <>
        <IconButton label="First" icon={<Pencil aria-hidden="true" />} />
        <IconButton label="Second" icon={<Pencil aria-hidden="true" />} />
      </>,
    );

    fireEvent.focus(screen.getByRole('button', { name: 'First' }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('First');

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Second' }));
    act(() => {
      vi.advanceTimersByTime(600);
    });

    const tooltips = screen.getAllByRole('tooltip');
    expect(tooltips).toHaveLength(1);
    expect(tooltips[0]).toHaveTextContent('Second');
  });

  it('forwards the ref to the underlying button', () => {
    const ref = createRef<HTMLButtonElement>();
    renderUi(<IconButton ref={ref} label="Edit person" icon={<Pencil aria-hidden="true" />} />);

    expect(ref.current).toBe(screen.getByRole('button', { name: 'Edit person' }));
  });
});

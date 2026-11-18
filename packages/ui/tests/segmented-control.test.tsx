import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { SegmentedControl } from '@doru/ui';
import { renderUi } from '../../../test/ui/harness';

const options = [
  { value: 'sources', label: 'Sources' },
  { value: 'titles', label: 'Titles' },
  { value: 'places', label: 'Places' },
] as const;

describe('SegmentedControl', () => {
  it('moves focus with horizontal arrows without changing the selection', () => {
    const onChange = vi.fn();
    renderUi(<SegmentedControl label="Kinds" mode="tabs" value="sources" onChange={onChange} options={options} />);

    const tabs = screen.getAllByRole('tab');
    const sources = tabs[0]!;
    const titles = tabs[1]!;
    const places = tabs[2]!;

    sources.focus();
    fireEvent.keyDown(sources, { key: 'ArrowRight' });
    expect(titles).toHaveFocus();
    fireEvent.keyDown(titles, { key: 'ArrowRight' });
    expect(places).toHaveFocus();
    fireEvent.keyDown(places, { key: 'ArrowRight' });
    expect(sources).toHaveFocus();
    fireEvent.keyDown(sources, { key: 'ArrowLeft' });
    expect(places).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves vertical arrows to the page in a horizontal tablist', () => {
    renderUi(<SegmentedControl label="Kinds" mode="tabs" value="sources" onChange={vi.fn()} options={options} />);

    const sources = screen.getAllByRole('tab')[0]!;
    sources.focus();
    fireEvent.keyDown(sources, { key: 'ArrowDown' });
    fireEvent.keyDown(sources, { key: 'ArrowUp' });
    expect(sources).toHaveFocus();
  });

  it('keeps one tab stop that follows focus and returns to the selected tab', () => {
    renderUi(<SegmentedControl label="Kinds" mode="tabs" value="sources" onChange={vi.fn()} options={options} />);

    const tabs = screen.getAllByRole('tab');
    const sources = tabs[0]!;
    const places = tabs[2]!;

    expect(sources).toHaveAttribute('tabindex', '0');
    sources.focus();
    fireEvent.keyDown(sources, { key: 'ArrowLeft' });
    expect(places).toHaveFocus();
    expect(sources).toHaveAttribute('tabindex', '-1');
    expect(places).toHaveAttribute('tabindex', '0');

    fireEvent.blur(places);
    expect(sources).toHaveAttribute('tabindex', '0');
    expect(places).toHaveAttribute('tabindex', '-1');
  });

  it('wires tabs to their controlled panel', () => {
    renderUi(
      <SegmentedControl
        label="Kinds"
        mode="tabs"
        idPrefix="kind"
        panelId="kind-panel"
        value="sources"
        onChange={vi.fn()}
        options={options}
      />,
    );

    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveAttribute('aria-controls', 'kind-panel');
    }
    expect(screen.getByRole('tab', { name: 'Sources' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Titles' })).toHaveAttribute('aria-selected', 'false');
  });
});

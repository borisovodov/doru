import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createEvent, fireEvent, screen } from '@testing-library/react';
import { SegmentedControl } from '@doru/ui';
import { renderUi } from '../../../test/ui/harness';

const options = [
  { value: 'sources', label: 'Sources' },
  { value: 'titles', label: 'Titles' },
  { value: 'places', label: 'Places' },
] as const;

type Kind = (typeof options)[number]['value'];

function tabStops(): HTMLElement[] {
  return screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0);
}

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
    for (const key of ['ArrowDown', 'ArrowUp']) {
      const event = createEvent.keyDown(sources, { key });
      fireEvent(sources, event);
      expect(event.defaultPrevented).toBe(false);
      expect(sources).toHaveFocus();
    }
  });

  it('keeps one tab stop that follows focus and returns to the selected tab', () => {
    renderUi(<SegmentedControl label="Kinds" mode="tabs" value="sources" onChange={vi.fn()} options={options} />);

    const tabs = screen.getAllByRole('tab');
    const sources = tabs[0]!;
    const places = tabs[2]!;

    expect(tabStops()).toEqual([sources]);
    sources.focus();
    fireEvent.keyDown(sources, { key: 'ArrowLeft' });
    expect(places).toHaveFocus();
    expect(tabStops()).toEqual([places]);

    fireEvent.blur(places);
    expect(tabStops()).toEqual([sources]);
  });

  it('follows a focused option across reordering', () => {
    function Fixture(): ReactNode {
      const [kind, setKind] = useState<Kind>('sources');
      return (
        <SegmentedControl
          label="Kinds"
          mode="tabs"
          value={kind}
          onChange={setKind}
          options={kind === 'titles' ? options.slice(1) : options}
        />
      );
    }

    const { rerender } = renderUi(<Fixture />);
    const tabs = screen.getAllByRole('tab');
    tabs[1]!.focus();
    fireEvent.focusIn(tabs[1]!);
    expect(tabStops()).toEqual([tabs[1]]);

    // Select the focused tab and drop the first option: the focused value moves
    // to index 0, and the stored value must keep it as the tab stop.
    fireEvent.click(tabs[1]!);
    rerender(<Fixture />);
    expect(tabStops()).toEqual([screen.getByRole('tab', { name: 'Titles' })]);
  });

  it('wires tabs to their controlled panel', () => {
    function Fixture(): ReactNode {
      const [kind, setKind] = useState<Kind>('sources');
      return (
        <>
          <SegmentedControl
            label="Kinds"
            mode="tabs"
            idPrefix="kind"
            panelId="kind-panel"
            value={kind}
            onChange={setKind}
            options={options}
          />
          <div role="tabpanel" id="kind-panel" aria-labelledby={`kind-${kind}`}>
            Panel
          </div>
        </>
      );
    }

    renderUi(<Fixture />);
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveAttribute('aria-controls', 'kind-panel');
    }
    expect(screen.getByRole('tab', { name: 'Sources' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Titles' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel', { name: 'Sources' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Titles' }));
    expect(screen.getByRole('tabpanel', { name: 'Titles' })).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { nls } from '@doru/workbench';
import { TabBar, type TabInfo } from '../src/components/TabBar';
import { renderUi } from '../../../test/ui/harness';

const tabs: TabInfo[] = [
  { id: 'tree', label: 'Tree' },
  { id: 'person:1', label: 'Ada Lovelace' },
  { id: 'settings', label: 'Settings' },
];

function tabRect(index: number): DOMRect {
  return {
    x: index * 100,
    y: 0,
    left: index * 100,
    top: 0,
    right: index * 100 + 100,
    bottom: 30,
    width: 100,
    height: 30,
    toJSON: () => ({}),
  };
}

describe('TabBar', () => {
  it('marks the active tab and selects on click', () => {
    const onSelect = vi.fn();
    renderUi(<TabBar tabs={tabs} activeId="person:1" onSelect={onSelect} onClose={vi.fn()} platform="linux" />);

    expect(screen.getByRole('tab', { name: 'Ada Lovelace' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Tree' })).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(screen.getByRole('tab', { name: 'Tree' }));
    expect(onSelect).toHaveBeenCalledWith('tree');
  });

  it('closes a tab from its close button and from a middle click', () => {
    const onClose = vi.fn();
    renderUi(<TabBar tabs={tabs} activeId="tree" onSelect={vi.fn()} onClose={onClose} platform="linux" />);

    fireEvent.click(screen.getByRole('button', { name: `${nls.t('workbench.tab.close')}: Ada Lovelace` }));
    expect(onClose).toHaveBeenCalledWith('person:1');

    fireEvent(screen.getByRole('tab', { name: 'Settings' }), new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    expect(onClose).toHaveBeenCalledWith('settings');
  });

  it('reorders after the pointer passes the drag threshold', () => {
    const onReorder = vi.fn();
    renderUi(
      <TabBar
        tabs={tabs}
        activeId="tree"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onReorder={onReorder}
        platform="linux"
      />,
    );

    const tabElements = screen.getAllByRole('tab');
    tabElements.forEach((element, index) => {
      element.getBoundingClientRect = () => tabRect(index);
    });

    const first = screen.getByRole('tab', { name: 'Tree' });
    fireEvent.pointerDown(first, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(first, { pointerId: 1, clientX: 230, clientY: 10 });
    fireEvent.pointerUp(first, { pointerId: 1, clientX: 230, clientY: 10 });

    expect(onReorder).toHaveBeenCalledWith('tree', 1);
  });

  it('does not reorder before the pointer passes the threshold', () => {
    const onReorder = vi.fn();
    renderUi(
      <TabBar
        tabs={tabs}
        activeId="tree"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onReorder={onReorder}
        platform="linux"
      />,
    );

    const first = screen.getByRole('tab', { name: 'Tree' });
    fireEvent.pointerDown(first, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(first, { pointerId: 1, clientX: 12, clientY: 10 });
    fireEvent.pointerUp(first, { pointerId: 1, clientX: 12, clientY: 10 });

    expect(onReorder).not.toHaveBeenCalled();
  });
});

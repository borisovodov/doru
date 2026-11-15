import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { DateEditor, emptyDate } from '@doru/ui/domain';
import { nls } from '../src/nls';
import { renderUi } from '../../../test/ui/harness';

const yearLabel = nls.t('features.tree.date.yearPlaceholder');
const monthLabel = nls.t('features.tree.date.monthPlaceholder');
const dayLabel = nls.t('features.tree.date.dayPlaceholder');
const qualityLabel = nls.t('features.tree.date.quality');

describe('DateEditor', () => {
  it('reports every edited date component', () => {
    const onChange = vi.fn();
    renderUi(<DateEditor label="Birth" value={emptyDate()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(yearLabel), { target: { value: '1900' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ year: '1900' }));

    fireEvent.change(screen.getAllByLabelText(monthLabel)[0]!, { target: { value: '5' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ month: '5' }));

    fireEvent.change(screen.getByLabelText(dayLabel), { target: { value: '3' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ day: '3' }));
  });

  it('switches to the range form and back', () => {
    const onChange = vi.fn();
    const { rerender } = renderUi(<DateEditor label="Birth" value={emptyDate()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(qualityLabel), { target: { value: 'range' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ quality: 'range' }));

    rerender(<DateEditor label="Birth" value={{ ...emptyDate(), quality: 'range' }} onChange={onChange} />);
    expect(screen.getByLabelText(nls.t('features.tree.date.endCalendar'))).toBeInTheDocument();
    expect(screen.queryByLabelText(nls.t('features.tree.date.modifier'))).not.toBeInTheDocument();

    rerender(<DateEditor label="Birth" value={{ ...emptyDate(), quality: 'unknown' }} onChange={onChange} />);
    expect(screen.queryByLabelText(nls.t('features.tree.date.endCalendar'))).not.toBeInTheDocument();
    expect(screen.queryByLabelText(nls.t('features.tree.date.modifier'))).not.toBeInTheDocument();
  });

  it('hides the place input when asked and toggles the BCE era', () => {
    const onChange = vi.fn();
    renderUi(<DateEditor label="Sort date" value={emptyDate()} onChange={onChange} hidePlace />);

    expect(screen.queryByLabelText(nls.t('features.tree.field.place'))).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(nls.t('features.tree.date.bce')));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ epoch: 'BCE' }));
  });
});

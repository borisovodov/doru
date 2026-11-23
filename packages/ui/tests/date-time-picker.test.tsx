import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Calendar } from '../src/atoms/calendar/Calendar';
import { DateTimePicker } from '../src/atoms/date-time-picker/DateTimePicker';
import { renderUi } from '../../../test/ui/harness';

const labels = {
  chooseDate: 'Choose date',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  today: 'Today',
  clear: 'Clear',
};

afterEach(() => {
  vi.useRealTimers();
});

describe('Calendar', () => {
  it('shows the selected month and selects a day', () => {
    const onSelect = vi.fn();
    renderUi(
      <Calendar
        value={new Date(2026, 10, 22)}
        locale="en"
        previousMonthLabel={labels.previousMonth}
        nextMonthLabel={labels.nextMonth}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText('November 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /November 10, 2026/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    const selected = onSelect.mock.calls[0]?.[0];
    if (selected === undefined) {
      throw new Error('the calendar did not report a day');
    }
    expect(selected.getDate()).toBe(10);
  });

  it('switches months and moves the roving focus with the keyboard', () => {
    const onSelect = vi.fn();
    renderUi(
      <Calendar
        value={new Date(2026, 10, 22)}
        locale="en"
        previousMonthLabel={labels.previousMonth}
        nextMonthLabel={labels.nextMonth}
        onSelect={onSelect}
      />,
    );

    const selectedDay = screen.getByRole('button', { name: /November 22, 2026/ });
    expect(selectedDay).toHaveFocus();

    fireEvent.keyDown(selectedDay, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: /November 23, 2026/ })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('button', { name: /November 23, 2026/ }), { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: /November 30, 2026/ })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: labels.nextMonth }));
    expect(screen.getByText('December 2026')).toBeInTheDocument();
  });

  it('keeps the roving focus inside the visible month after an adjacent-day focus', () => {
    renderUi(
      <Calendar
        value={new Date(2026, 1, 1)}
        locale="en"
        previousMonthLabel={labels.previousMonth}
        nextMonthLabel={labels.nextMonth}
        onSelect={vi.fn()}
      />,
    );

    const marchDay = screen.getByRole('button', { name: /March 8, 2026/ });
    fireEvent.focus(marchDay);
    fireEvent.click(screen.getByRole('button', { name: labels.nextMonth }));

    expect(screen.getByText('March 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /March 8, 2026/ })).toHaveAttribute('tabindex', '0');
  });
});

describe('DateTimePicker', () => {
  it('picks a day from the calendar and keeps the time', () => {
    const onChange = vi.fn();
    renderUi(<DateTimePicker value="2026-11-22T18:30" onChange={onChange} locale="en" labels={labels} />);

    fireEvent.click(screen.getByRole('button', { name: labels.chooseDate }));
    expect(screen.getByRole('dialog', { name: labels.chooseDate })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /November 10, 2026/ }));
    expect(onChange).toHaveBeenCalledWith('2026-11-10T18:30');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('defaults an empty field to 09:00 and hides clear', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 22, 12, 0));
    const onChange = vi.fn();
    renderUi(<DateTimePicker value="" onChange={onChange} locale="en" labels={labels} />);

    fireEvent.click(screen.getByRole('button', { name: labels.chooseDate }));
    expect(screen.queryByRole('button', { name: labels.clear })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /November 10, 2026/ }));
    expect(onChange).toHaveBeenLastCalledWith('2026-11-10T09:00');
  });

  it('closes the calendar when manual entry changes the date', () => {
    const { container } = renderUi(
      <DateTimePicker value="2026-11-22T18:30" onChange={() => undefined} locale="en" labels={labels} />,
    );

    fireEvent.click(screen.getByRole('button', { name: labels.chooseDate }));
    expect(screen.getByRole('dialog', { name: labels.chooseDate })).toBeInTheDocument();

    const input = container.querySelector('input[type="datetime-local"]');
    if (input === null) {
      throw new Error('the picker input is missing');
    }
    fireEvent.change(input, { target: { value: '2026-12-03T18:30' } });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    renderUi(<DateTimePicker value="2026-11-22T18:30" onChange={() => undefined} locale="en" labels={labels} />);

    const trigger = screen.getByRole('button', { name: labels.chooseDate });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: labels.chooseDate })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('clears a set value with one click on the inline clear button', () => {
    const onChange = vi.fn();
    renderUi(<DateTimePicker value="2026-11-22T18:30" onChange={onChange} locale="en" labels={labels} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: labels.clear }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('hides the clear button when there is nothing to clear', () => {
    renderUi(<DateTimePicker value="" onChange={() => undefined} locale="en" labels={labels} />);
    expect(screen.queryByRole('button', { name: labels.clear })).not.toBeInTheDocument();
  });

  it('hides the clear action for a required field', () => {
    renderUi(
      <DateTimePicker
        value="2026-11-22T09:00"
        onChange={() => undefined}
        locale="en"
        labels={labels}
        nullable={false}
      />,
    );
    expect(screen.queryByRole('button', { name: labels.clear })).not.toBeInTheDocument();
  });
});

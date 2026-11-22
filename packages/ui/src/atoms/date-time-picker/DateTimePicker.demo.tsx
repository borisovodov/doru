import { useState } from 'react';
import type { Demo, DemoMeta } from '../../../gallery/types';
import { DateTimePicker } from './DateTimePicker';

const labels = {
  chooseDate: 'Choose date',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  today: 'Today',
  clear: 'Clear',
};

function StatefulDateTimePicker({ initial, nullable = true }: { initial: string; nullable?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <div style={{ width: 260 }}>
      <DateTimePicker value={value} onChange={setValue} locale="en" labels={labels} nullable={nullable} />
    </div>
  );
}

const meta = {
  title: 'Atoms/DateTimePicker',
  component: DateTimePicker,
  decorators: [
    (Story) => (
      <div style={{ padding: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies DemoMeta<typeof DateTimePicker>;

export default meta;
type DemoCase = Demo;

export const Nullable: DemoCase = {
  render: () => <StatefulDateTimePicker initial="2026-11-22T18:30" />,
};

export const Required: DemoCase = {
  render: () => <StatefulDateTimePicker initial="2026-11-22T09:00" nullable={false} />,
};

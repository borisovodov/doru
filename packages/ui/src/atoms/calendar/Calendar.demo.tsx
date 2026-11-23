import { useState } from 'react';
import type { Demo, DemoMeta } from '../../../gallery/types';
import { Calendar } from './Calendar';
import { nls } from '../../nls';

function StatefulCalendar() {
  const [value, setValue] = useState(() => new Date(2026, 10, 22));
  return (
    <Calendar
      value={value}
      locale="en"
      previousMonthLabel={nls.t('features.tasks.previousMonth')}
      nextMonthLabel={nls.t('features.tasks.nextMonth')}
      onSelect={setValue}
    />
  );
}

const meta = {
  title: 'Atoms/Calendar',
  component: Calendar,
  decorators: [
    (Story) => (
      <div style={{ width: 264, padding: 8 }}>
        <Story />
      </div>
    ),
  ],
  render: () => <StatefulCalendar />,
} satisfies DemoMeta<typeof Calendar>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

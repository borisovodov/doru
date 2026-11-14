import { useState, type ComponentProps } from 'react';
import type { Demo, DemoMeta } from '../../../gallery/types';
import { DateEditor } from './DateEditor';
import { emptyDate } from '../person/draft';

function StatefulDateEditor(args: ComponentProps<typeof DateEditor>) {
  const [value, setValue] = useState(args.value);
  return <DateEditor {...args} value={value} onChange={setValue} />;
}

const meta = {
  title: 'Domain/DateEditor',
  component: DateEditor,
  args: {
    label: 'Birth date',
    value: emptyDate(),
    onChange: () => undefined,
  },
  render: (args) => <StatefulDateEditor {...(args as ComponentProps<typeof StatefulDateEditor>)} />,
} satisfies DemoMeta<typeof DateEditor>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const Range: DemoCase = {
  args: {
    label: 'Marriage date',
    value: { ...emptyDate(), year: '1890', month: '5', day: '12', quality: 'range', endYear: '1891' },
  },
};

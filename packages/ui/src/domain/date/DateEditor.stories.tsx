import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
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
  render: (args) => <StatefulDateEditor {...args} />,
} satisfies Meta<typeof DateEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Range: Story = {
  args: {
    label: 'Marriage date',
    value: { ...emptyDate(), year: '1890', month: '5', day: '12', quality: 'range', endYear: '1891' },
  },
};

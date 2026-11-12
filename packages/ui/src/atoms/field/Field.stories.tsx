import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field } from './Field';
import { Input } from '../form/Input';
import { Select } from '../form/Select';

const meta = {
  title: 'Atoms/Field',
  component: Field,
  args: {
    label: 'Given name',
    hint: 'The name as it appears in the record.',
    children: <Input defaultValue="Ivan" />,
  },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Required: Story = {
  args: { required: true },
};

export const WithError: Story = {
  args: { error: 'This field cannot be empty.', children: <Input invalid /> },
};

export const WithSelect: Story = {
  args: {
    label: 'Sex',
    children: (
      <Select defaultValue="U">
        <option value="U">Unknown</option>
        <option value="M">Male</option>
        <option value="F">Female</option>
      </Select>
    ),
  },
};

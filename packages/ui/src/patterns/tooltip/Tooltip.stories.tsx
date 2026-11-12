import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../../atoms/button/Button';
import { Tooltip } from './Tooltip';

const meta = {
  title: 'Patterns/Tooltip',
  component: Tooltip,
  args: {
    label: 'Add a child',
    children: <Button variant="secondary">Hover me</Button>,
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

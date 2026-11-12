import type { Meta, StoryObj } from '@storybook/react-vite';
import { Users } from 'lucide-react';
import { EntityCard } from './EntityCard';

const meta = {
  title: 'Patterns/EntityCard',
  component: EntityCard,
  args: {
    icon: <Users size={15} />,
    title: 'Ivan & Maria Ivanov',
    subtitle: '2 children',
    meta: '2',
    onClick: () => undefined,
  },
} satisfies Meta<typeof EntityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Family: Story = {};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import { IconButton } from './IconButton';

const meta = {
  title: 'Atoms/IconButton',
  component: IconButton,
  args: {
    label: 'Edit',
    icon: <Pencil size={14} />,
    size: 'md',
    variant: 'ghost',
  },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg', 'nav'] },
    variant: { control: 'select', options: ['ghost', 'active', 'primary', 'secondary', 'danger'] },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconButton size="sm" label="Edit" icon={<Pencil size={13} />} />
        <IconButton size="md" label="Edit" icon={<Pencil size={14} />} />
        <IconButton size="lg" label="Edit" icon={<Pencil size={16} />} />
        <IconButton size="nav" label="Settings" icon={<Settings size={24} />} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconButton size="md" variant="primary" label="Add" icon={<Plus size={16} />} />
        <IconButton size="md" variant="secondary" label="Edit" icon={<Pencil size={14} />} />
        <IconButton size="md" variant="danger" label="Delete" icon={<Trash2 size={14} />} />
      </div>
    </div>
  ),
};

export const Ghost: Story = {};

export const Active: Story = {
  args: { label: 'Settings', icon: <Settings size={16} />, variant: 'active' },
};

export const Primary: Story = {
  args: { label: 'Add', icon: <Plus size={16} />, variant: 'primary', size: 'nav' },
};

export const Danger: Story = {
  args: { label: 'Delete', icon: <Trash2 size={14} />, variant: 'danger' },
};



import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta = {
  title: 'Atoms/Button',
  component: Button,
  args: {
    children: 'Save',
    variant: 'primary',
    size: 'md',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger', 'link'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12 }}>
      {([
        ['primary', 'Primary'],
        ['secondary', 'Secondary'],
        ['ghost', 'Ghost'],
        ['danger', 'Danger'],
        ['link', 'Link'],
      ] as const).map(([variant, label]) => (
        <div key={variant} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant={variant} size="sm">{label} sm</Button>
          <Button variant={variant} size="md">{label} md</Button>
          <Button variant={variant} size="lg">{label} lg</Button>
        </div>
      ))}
    </div>
  ),
};

export const Primary: Story = {};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Cancel' },
};

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'More' },
};

export const Danger: Story = {
  args: { variant: 'danger', children: 'Delete' },
};

export const Link: Story = {
  args: { variant: 'link', children: 'Open themes folder' },
};

export const Disabled: Story = {
  args: { disabled: true, children: 'Disabled' },
};

export const Loading: Story = {
  args: { loading: true, children: 'Saving' },
};

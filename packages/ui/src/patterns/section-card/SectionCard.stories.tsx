import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../../atoms/button/Button';
import { SectionCard } from './SectionCard';

const meta = {
  title: 'Patterns/SectionCard',
  component: SectionCard,
  args: {
    title: 'Sources',
    children: <p style={{ margin: 0, color: 'var(--doru-fg-muted)' }}>No sources cited yet.</p>,
  },
} satisfies Meta<typeof SectionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActions: Story = {
  args: { actions: <Button size="sm" variant="primary">Add</Button> },
};

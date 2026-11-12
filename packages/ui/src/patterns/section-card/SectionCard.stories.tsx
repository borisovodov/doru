import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../../atoms/button/Button';
import { EmptyText } from '../../atoms/feedback/EmptyText';
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

export const EmptyWithAction: Story = {
  args: {
    title: 'Associations',
    children: (
      <>
        <EmptyText>No associations yet.</EmptyText>
        <Button variant="primary" size="sm">
          Add association
        </Button>
      </>
    ),
  },
};

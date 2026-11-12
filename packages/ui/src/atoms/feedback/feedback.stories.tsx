import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyText } from './EmptyText';
import { Hint } from './Hint';
import { InlineError } from './InlineError';
import { Progress } from './Progress';

const meta = {
  title: 'Atoms/Feedback',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProgressBars: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 10, width: 280 }}>
      <Progress value={35} max={100} label="Download progress" />
      <Progress value={100} max={100} label="Complete" />
    </div>
  ),
};

export const Errors: Story = {
  render: () => <InlineError>The connection to the AI assistant was interrupted.</InlineError>,
};

export const Hints: Story = {
  render: () => <Hint>The operating system decides between light and dark.</Hint>,
};

export const EmptyStates: Story = {
  render: () => <EmptyText>No notes yet.</EmptyText>,
};

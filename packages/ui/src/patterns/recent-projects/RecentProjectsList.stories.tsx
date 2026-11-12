import type { Meta, StoryObj } from '@storybook/react-vite';
import { RecentProjectsList } from './RecentProjectsList';

const meta = {
  title: 'Patterns/RecentProjectsList',
  component: RecentProjectsList,
  args: {
    recent: [
      { path: '/Users/ivan/Documents/Ivanov family.doru', lastOpenedAt: '2026-01-01T00:00:00Z' },
      { path: '/Users/ivan/Documents/Sidorov family.doru', lastOpenedAt: '2026-01-02T00:00:00Z' },
    ],
    onOpen: () => undefined,
    onRemove: () => undefined,
  },
} satisfies Meta<typeof RecentProjectsList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { recent: [] },
};

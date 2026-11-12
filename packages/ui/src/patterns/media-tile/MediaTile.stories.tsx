import type { Meta, StoryObj } from '@storybook/react-vite';
import { MediaTile } from './MediaTile';

const meta = {
  title: 'Patterns/MediaTile',
  component: MediaTile,
  args: {
    src: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Crect width=%22120%22 height=%22120%22 fill=%22%23334455%22/%3E%3C/svg%3E',
    alt: 'Placeholder photo',
    onRemove: () => undefined,
    removeLabel: 'Remove photo',
  },
} satisfies Meta<typeof MediaTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReorderButtons } from './ReorderButtons';

const meta = {
  title: 'Atoms/ReorderButtons',
  component: ReorderButtons,
  args: {
    upLabel: 'Move up',
    downLabel: 'Move down',
    canMoveUp: true,
    canMoveDown: true,
    onMoveUp: () => undefined,
    onMoveDown: () => undefined,
  },
} satisfies Meta<typeof ReorderButtons>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Edges: Story = {
  args: { canMoveUp: false, canMoveDown: false },
};

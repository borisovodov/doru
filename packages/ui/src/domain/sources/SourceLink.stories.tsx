import type { Meta, StoryObj } from '@storybook/react-vite';
import { SourceLink } from './SourceLink';

const meta = {
  title: 'Domain/SourceLink',
  component: SourceLink,
  args: {
    title: 'Parish register of Ivanovka',
    onClick: () => undefined,
  },
} satisfies Meta<typeof SourceLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

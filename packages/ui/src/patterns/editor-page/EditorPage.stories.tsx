import type { Meta, StoryObj } from '@storybook/react-vite';
import { EditorPage } from './EditorPage';
import { SectionCard } from '../section-card/SectionCard';

const meta = {
  title: 'Patterns/EditorPage',
  component: EditorPage,
  args: {
    children: <SectionCard title="Details">Editor content</SectionCard>,
  },
} satisfies Meta<typeof EditorPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { TaskEditorFields } from './TaskEditorFields';
import { emptyTodoDraft } from './todoDraft';

const meta = {
  title: 'Domain/TaskEditorFields',
  component: TaskEditorFields,
  args: {
    edit: { ...emptyTodoDraft(), text: 'Find the parish register' },
    persons: [],
    repositories: [],
    onChange: () => undefined,
  },
} satisfies Meta<typeof TaskEditorFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

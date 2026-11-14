import type { Meta, StoryObj } from '@storybook/react-vite';
import type { TodoRecord } from '@doru/core';
import { TasksView } from './TasksView';

const todos: TodoRecord[] = [
  {
    id: 'T1',
    text: 'Find the parish register',
    priority: 'high',
    status: 'open',
    category: 'Research',
  },
  {
    id: 'T2',
    text: 'Translate the 1890 census',
    priority: 'medium',
    status: 'in-progress',
    category: 'Translation',
  },
];

const meta = {
  title: 'Domain/TasksView',
  component: TasksView,
  args: {
    todos,
    persons: [],
    families: [],
    sources: [],
    places: [],
    repositories: [],
    titles: [],
    onOpenTask: () => undefined,
    onNewTask: () => undefined,
    onOpenPerson: () => undefined,
    onOpenFamily: () => undefined,
    onOpenSource: () => undefined,
    onOpenPlace: () => undefined,
    onOpenRepository: () => undefined,
    onOpenTitle: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 260, padding: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TasksView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { todos: [] },
};

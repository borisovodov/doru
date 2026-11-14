import type { Meta, StoryObj } from '@storybook/react-vite';
import type { TodoRecord } from '@doru/core';
import { TasksSection } from './TasksSection';

const tasks: TodoRecord[] = [
  {
    id: 'T1',
    text: 'Find the parish register',
    targetType: 'person',
    targetId: 'I1',
    priority: 'high',
    status: 'open',
    category: 'Research',
  },
  {
    id: 'T2',
    text: 'Translate the 1890 census',
    targetType: 'person',
    targetId: 'I1',
    priority: 'medium',
    status: 'closed',
    scheduledDate: { quality: 'exact', component: { year: 2026, month: 5, day: 12 } },
  },
];

const api = {
  getTodosFor: async () => tasks,
  addTodo: async () => undefined,
  deleteTodo: async () => undefined,
  openTask: () => undefined,
};

const meta = {
  title: 'Domain/TasksSection',
  component: TasksSection,
  args: {
    targetType: 'person',
    targetId: 'I1',
    api,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360, padding: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TasksSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    api: {
      ...api,
      getTodosFor: async () => [],
    },
  },
};

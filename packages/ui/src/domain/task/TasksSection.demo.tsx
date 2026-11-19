import type { Demo, DemoMeta } from '../../../gallery/types';
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
      <div style={{ width: 360, padding: 'var(--doru-space-6)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies DemoMeta<typeof TasksSection>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const Empty: DemoCase = {
  args: {
    api: {
      ...api,
      getTodosFor: async () => [],
    },
  },
};

import type { Demo, DemoMeta } from '../../../gallery/types';
import type { TaskRecord } from '@doru/core';
import { TasksSection } from './TasksSection';

const tasks: TaskRecord[] = [
  {
    id: 'T1',
    text: 'Find the parish register',
    targetType: 'person',
    targetId: 'I1',
    priority: 'high',
    status: 'open',
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
  getTasksFor: async () => tasks,
  addTask: async () => undefined,
  deleteTask: async () => undefined,
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
} satisfies DemoMeta<typeof TasksSection>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const Empty: DemoCase = {
  args: {
    api: {
      ...api,
      getTasksFor: async () => [],
    },
  },
};

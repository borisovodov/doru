import type { Demo, DemoMeta } from '../../../gallery/types';
import type { TaskRecord } from '@doru/core';
import { TasksSection } from './TasksSection';

const tasks: TaskRecord[] = [
  {
    id: 'T1',
    text: 'Find the parish register',
    targets: [{ id: 'TL1', taskId: 'T1', targetType: 'person', targetId: 'I1' }],
    priority: 'high',
    status: 'open',
  },
  {
    id: 'T2',
    text: 'Translate the 1890 census',
    targets: [{ id: 'TL2', taskId: 'T2', targetType: 'person', targetId: 'I1' }],
    priority: 'medium',
    status: 'closed',
    remindAt: new Date(2026, 4, 12, 9, 0).getTime(),
  },
];

const otherTask: TaskRecord = {
  id: 'T3',
  text: 'Ask the archive about the 1890 census',
  targets: [],
  priority: 'low',
  status: 'open',
};

const api = {
  getTasksFor: async () => tasks,
  getAllTasks: async () => [...tasks, otherTask],
  addTask: async () => undefined,
  addTaskLink: async () => undefined,
  deleteTaskLink: async () => undefined,
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
      getAllTasks: async () => [],
    },
  },
};

import type { Demo, DemoMeta } from '../../../gallery/types';
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
    facts: [],
    citations: [],
    notes: [],
    media: [],
    submitters: [],
    addresses: [],
    associations: [],
    onOpenTask: () => undefined,
    onOpenPerson: () => undefined,
    onOpenFamily: () => undefined,
    onOpenSource: () => undefined,
    onOpenPlace: () => undefined,
    onOpenRepository: () => undefined,
    onOpenSubmitter: () => undefined,
    onOpenAddress: () => undefined,
    onOpenMedia: () => undefined,
    onOpenTitle: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 260, padding: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies DemoMeta<typeof TasksView>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const Empty: DemoCase = {
  args: { todos: [] },
};

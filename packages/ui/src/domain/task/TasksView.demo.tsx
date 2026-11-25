import type { Demo, DemoMeta } from '../../../gallery/types';
import type { PersonRecord, TaskRecord } from '@doru/core';
import { TasksView } from './TasksView';

const tasks: TaskRecord[] = [
  {
    id: 'T1',
    text: 'Find the parish register',
    targets: [],
    priority: 'high',
    status: 'open',
  },
  {
    id: 'T2',
    text: 'Translate the 1890 census',
    targets: [{ id: 'TL2', taskId: 'T2', targetType: 'person', targetId: 'P1' }],
    priority: 'medium',
    status: 'in-progress',
  },
];

const relatedPerson: PersonRecord = {
  id: 'P1',
  names: [{ id: 'N1', given: 'Ivan', surname: 'Ivanov' }],
  sex: 'M',
  facts: [],
};

const relatedTask: TaskRecord = {
  id: 'T3',
  text: 'Check the census entry',
  status: 'open',
  targets: [{ id: 'TL3', taskId: 'T3', targetType: 'person', targetId: 'P1' }],
};

const meta = {
  title: 'Domain/TasksView',
  component: TasksView,
  args: {
    tasks,
    persons: [],
    families: [],
    sources: [],
    places: [],
    repositories: [],
    titles: [],
    facts: [],
    citations: [],
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
  args: { tasks: [] },
};

export const RelatedRecord: DemoCase = {
  args: {
    tasks: [relatedTask],
    persons: [relatedPerson],
    selectedId: relatedTask.id,
  },
};

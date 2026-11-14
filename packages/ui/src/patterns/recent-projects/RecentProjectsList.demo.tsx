import type { Demo, DemoMeta } from '../../../gallery/types';
import { RecentProjectsList } from './RecentProjectsList';

const meta = {
  title: 'Patterns/RecentProjectsList',
  component: RecentProjectsList,
  args: {
    recent: [
      { path: '/Users/ivan/Documents/Ivanov family.doru', lastOpenedAt: '2026-01-01T00:00:00Z' },
      { path: '/Users/ivan/Documents/Sidorov family.doru', lastOpenedAt: '2026-01-02T00:00:00Z' },
    ],
    onOpen: () => undefined,
    onRemove: () => undefined,
  },
} satisfies DemoMeta<typeof RecentProjectsList>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const Empty: DemoCase = {
  args: { recent: [] },
};

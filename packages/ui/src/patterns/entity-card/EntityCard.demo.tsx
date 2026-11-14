import type { Demo, DemoMeta } from '../../../gallery/types';
import { Users } from 'lucide-react';
import { EntityCard } from './EntityCard';

const meta = {
  title: 'Patterns/EntityCard',
  component: EntityCard,
  args: {
    icon: <Users size={15} />,
    title: 'Ivan & Maria Ivanov',
    subtitle: '2 children',
    meta: '2',
    onClick: () => undefined,
  },
} satisfies DemoMeta<typeof EntityCard>;

export default meta;
type DemoCase = Demo;

export const Family: DemoCase = {};

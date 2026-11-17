import type { Demo, DemoMeta } from '../../../gallery/types';
import { Users } from 'lucide-react';
import { EntityRow } from './EntityRow';

const meta = {
  title: 'Patterns/EntityRow',
  component: EntityRow,
  args: {
    icon: <Users size={15} />,
    title: 'Ivan & Maria Ivanov',
    subtitle: '2 children',
    meta: '2',
    onClick: () => undefined,
  },
} satisfies DemoMeta<typeof EntityRow>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const Selected: DemoCase = {
  args: { ...meta.args, selected: true },
};

export const List: DemoCase = {
  render: () => (
    <div style={{ width: 260 }}>
      <EntityRow {...meta.args} />
      <EntityRow {...meta.args} title="Petr Ivanov" subtitle="1 child" meta="1" selected />
      <EntityRow {...meta.args} title="Anna Ivanova" subtitle={undefined} meta={undefined} />
    </div>
  ),
};

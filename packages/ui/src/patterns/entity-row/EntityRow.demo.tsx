import type { Demo, DemoMeta } from '../../../gallery/types';
import { Users } from 'lucide-react';
import { Avatar } from '../../atoms/display/Avatar';
import { EntityRow } from './EntityRow';

const portrait =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 68 68%22%3E%3Crect width=%2268%22 height=%2268%22 fill=%22%2363a37f%22/%3E%3C/svg%3E';

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

export const AvatarRow: DemoCase = {
  render: () => (
    <div style={{ width: 260 }}>
      <EntityRow
        iconVariant="plain"
        icon={<Avatar initials="II" tone="male" size="md" shape="circle" />}
        title="Ivan Ivanov"
        subtitle="~1923"
        onClick={() => undefined}
      />
    </div>
  ),
};

export const ThumbnailRow: DemoCase = {
  render: () => (
    <div style={{ width: 260 }}>
      <EntityRow
        thumbnail={{ src: portrait, alt: '' }}
        title="Family portrait"
        subtitle="Attached to Ivan Ivanov"
        onClick={() => undefined}
      />
    </div>
  ),
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

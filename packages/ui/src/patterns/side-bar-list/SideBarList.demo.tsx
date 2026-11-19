import { Users } from 'lucide-react';
import type { Demo, DemoMeta } from '../../../gallery/types';
import { EntityRow } from '../entity-row/EntityRow';
import { SideBarList } from './SideBarList';

const meta = {
  title: 'Patterns/SideBarList',
} satisfies DemoMeta;

export default meta;
type DemoCase = Demo;

const row = {
  icon: <Users size={15} aria-hidden="true" />,
  onClick: () => undefined,
};

export const Default: DemoCase = {
  render: () => (
    <div style={{ width: 260 }}>
      <SideBarList>
        <li>
          <EntityRow {...row} title="Ivan & Maria Ivanov" subtitle="2 children" meta="2" />
        </li>
        <li>
          <EntityRow {...row} title="Petr Ivanov" subtitle="1 child" meta="1" selected />
        </li>
        <li>
          <EntityRow {...row} title="Anna Ivanova" />
        </li>
      </SideBarList>
    </div>
  ),
};

import { Plus } from 'lucide-react';
import type { Demo, DemoMeta } from '../../../gallery/types';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { SideBarHeading } from './SideBarHeading';

const meta = {
  title: 'Patterns/SideBarHeading',
} satisfies DemoMeta;

export default meta;
type DemoCase = Demo;

const add = (
  <IconButton size="sm" label="Add task" icon={<Plus size={14} aria-hidden="true" />} onClick={() => undefined} />
);

export const Default: DemoCase = {
  render: () => (
    <div style={{ width: 260, padding: 'var(--doru-space-6)' }}>
      <SideBarHeading title="Tasks" actions={add} />
    </div>
  ),
};

export const WithoutActions: DemoCase = {
  render: () => (
    <div style={{ width: 260, padding: 'var(--doru-space-6)' }}>
      <SideBarHeading title="Search" />
    </div>
  ),
};

import type { Demo, DemoMeta } from '../../../gallery/types';
import { SideBarEmpty } from './SideBarEmpty';

const meta = {
  title: 'Patterns/SideBarEmpty',
} satisfies DemoMeta;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {
  render: () => (
    <div style={{ width: 260 }}>
      <SideBarEmpty>No people yet.</SideBarEmpty>
    </div>
  ),
};

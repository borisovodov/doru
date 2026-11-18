import { Plus } from 'lucide-react';
import type { Demo, DemoMeta } from '../../../gallery/types';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { SideBarLayout } from './SideBarLayout';

const meta = {
  title: 'Patterns/SideBarLayout',
} satisfies DemoMeta;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {
  render: () => (
    <div style={{ width: 260, height: 320, display: 'flex' }}>
      <SideBarLayout
        title="People"
        actions={
          <IconButton
            size="sm"
            label="Add person"
            icon={<Plus size={14} aria-hidden="true" />}
            onClick={() => undefined}
          />
        }
        subheader={
          <div style={{ fontSize: 'var(--doru-font-size-sm)', color: 'var(--doru-fg-muted)' }}>Fixed subheader</div>
        }
      >
        <p style={{ margin: 0, padding: '0 var(--doru-space-2)', color: 'var(--doru-fg-muted)' }}>
          Scrollable body content.
        </p>
      </SideBarLayout>
    </div>
  ),
};

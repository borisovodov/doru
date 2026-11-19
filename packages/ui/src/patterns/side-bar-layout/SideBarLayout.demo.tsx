import { Plus } from 'lucide-react';
import type { Demo, DemoMeta } from '../../../gallery/types';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { SideBarLayout } from './SideBarLayout';

const meta = {
  title: 'Patterns/SideBarLayout',
} satisfies DemoMeta;

export default meta;
type DemoCase = Demo;

const rows = Array.from({ length: 12 }, (_, index) => `Row ${index + 1}`);

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
        {rows.map((row) => (
          <p
            key={row}
            style={{
              margin: 0,
              padding: 'var(--doru-space-2) var(--doru-space-3)',
              color: 'var(--doru-fg-muted)',
            }}
          >
            {row}
          </p>
        ))}
      </SideBarLayout>
    </div>
  ),
};

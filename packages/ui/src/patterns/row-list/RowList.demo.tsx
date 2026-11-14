import type { Demo, DemoMeta } from '../../../gallery/types';
import { Pencil, X } from 'lucide-react';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { AttachmentRow, RowList } from './RowList';

const meta = {
  title: 'Patterns/RowList',
  component: RowList,
  args: {
    children: (
      <>
        <AttachmentRow
          kind="UID"
          value="550e8400-e29b-41d4-a716-446655440000"
          actions={
            <>
              <IconButton label="Edit" size="sm" icon={<Pencil size={13} />} />
              <IconButton label="Remove" size="sm" icon={<X size={13} />} />
            </>
          }
        />
        <AttachmentRow kind="SOSA" value="12345" />
      </>
    ),
  },
} satisfies DemoMeta<typeof RowList>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

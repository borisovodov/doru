import type { Demo, DemoMeta } from '../../../gallery/types';
import { Button } from '../button/Button';
import { Tooltip } from './Tooltip';

const meta = {
  title: 'Atoms/Tooltip',
  component: Tooltip,
  args: {
    label: 'Add a child',
    children: <Button variant="secondary">Hover me</Button>,
  },
} satisfies DemoMeta<typeof Tooltip>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const WithShortcut: DemoCase = {
  args: {
    label: 'Add a child',
    shortcut: '⌘N',
  },
};

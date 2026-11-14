import type { Demo, DemoMeta } from '../../../gallery/types';
import { ReorderButtons } from './ReorderButtons';

const meta = {
  title: 'Atoms/ReorderButtons',
  component: ReorderButtons,
  args: {
    upLabel: 'Move up',
    downLabel: 'Move down',
    canMoveUp: true,
    canMoveDown: true,
    onMoveUp: () => undefined,
    onMoveDown: () => undefined,
  },
} satisfies DemoMeta<typeof ReorderButtons>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const Edges: DemoCase = {
  args: { canMoveUp: false, canMoveDown: false },
};

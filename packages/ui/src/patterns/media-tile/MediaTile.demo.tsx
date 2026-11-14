import type { Demo, DemoMeta } from '../../../gallery/types';
import { MediaTile } from './MediaTile';

const meta = {
  title: 'Patterns/MediaTile',
  component: MediaTile,
  args: {
    src: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Crect width=%22120%22 height=%22120%22 fill=%22%23334455%22/%3E%3C/svg%3E',
    alt: 'Placeholder photo',
    onRemove: () => undefined,
    removeLabel: 'Remove photo',
  },
} satisfies DemoMeta<typeof MediaTile>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

import type { Demo, DemoMeta } from '../../../gallery/types';
import { MediaAddControl } from './MediaAddControl';

const noop = async () => undefined;

const meta = {
  title: 'Domain/MediaAddControl',
  component: MediaAddControl,
  args: {
    label: 'Add media…',
    onAddFiles: () => undefined,
    onAddUrl: noop,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360, padding: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies DemoMeta<typeof MediaAddControl>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const Compact: DemoCase = {
  args: { compact: true },
};

export const Disabled: DemoCase = {
  args: { disabled: true },
};

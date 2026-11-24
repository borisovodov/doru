import type { Demo, DemoMeta } from '../../../gallery/types';
import { AttachExisting } from './AttachExisting';

const options = [
  { id: 'N1', label: 'The family moved to Tula around 1905.' },
  { id: 'N2', label: 'The 1890 register is water-damaged; compare with the 1905 copy.' },
];

const meta = {
  title: 'Patterns/AttachExisting',
  component: AttachExisting,
  args: {
    label: 'Attach an existing note',
    actionLabel: 'Attach',
    options,
    onAttach: async () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, padding: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies DemoMeta<typeof AttachExisting>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const Empty: DemoCase = {
  args: { options: [] },
};

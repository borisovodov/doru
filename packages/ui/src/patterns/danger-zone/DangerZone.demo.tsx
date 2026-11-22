import type { Demo, DemoMeta } from '../../../gallery/types';
import { Button } from '../../atoms/button/Button';
import { DangerZone } from './DangerZone';

const meta = {
  title: 'Patterns/DangerZone',
  component: DangerZone,
  decorators: [
    (Story) => (
      <div style={{ width: 480, padding: 12 }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <DangerZone>
      <Button variant="danger">Delete</Button>
    </DangerZone>
  ),
} satisfies DemoMeta<typeof DangerZone>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

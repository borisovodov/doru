import type { Demo, DemoMeta } from '../../../gallery/types';
import { SourceLink } from './SourceLink';

const meta = {
  title: 'Domain/SourceLink',
  component: SourceLink,
  args: {
    title: 'Parish register of Ivanovka',
    onClick: () => undefined,
  },
} satisfies DemoMeta<typeof SourceLink>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

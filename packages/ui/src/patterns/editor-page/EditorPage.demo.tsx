import type { Demo, DemoMeta } from '../../../gallery/types';
import { EditorPage } from './EditorPage';
import { SectionCard } from '../section-card/SectionCard';

const meta = {
  title: 'Patterns/EditorPage',
  component: EditorPage,
  args: {
    children: <SectionCard title="Details">Editor content</SectionCard>,
  },
} satisfies DemoMeta<typeof EditorPage>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

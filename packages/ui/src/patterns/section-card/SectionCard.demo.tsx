import type { Demo, DemoMeta } from '../../../gallery/types';
import { Button } from '../../atoms/button/Button';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { SectionCard } from './SectionCard';

const meta = {
  title: 'Patterns/SectionCard',
  component: SectionCard,
  args: {
    title: 'Sources',
    children: <p style={{ margin: 0, color: 'var(--doru-fg-muted)' }}>No sources cited yet.</p>,
  },
} satisfies DemoMeta<typeof SectionCard>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const WithActions: DemoCase = {
  args: {
    actions: (
      <Button size="sm" variant="primary">
        Add
      </Button>
    ),
  },
};

export const EmptyWithAction: DemoCase = {
  args: {
    title: 'Associations',
    children: (
      <>
        <EmptyText>No associations yet.</EmptyText>
        <Button variant="primary" size="sm">
          Add association
        </Button>
      </>
    ),
  },
};

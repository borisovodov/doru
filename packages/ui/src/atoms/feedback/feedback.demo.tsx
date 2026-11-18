import type { Demo, DemoMeta } from '../../../gallery/types';
import { EmptyText } from './EmptyText';
import { Hint } from './Hint';
import { InlineError } from './InlineError';
import { Progress } from './Progress';

const meta = {
  title: 'Atoms/Feedback',
} satisfies DemoMeta;

export default meta;
type DemoCase = Demo;

export const ProgressBars: DemoCase = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--doru-space-5)', width: 280 }}>
      <Progress value={35} max={100} label="Download progress" />
      <Progress value={100} max={100} label="Complete" />
    </div>
  ),
};

export const Errors: DemoCase = {
  render: () => <InlineError>The connection to the AI assistant was interrupted.</InlineError>,
};

export const Hints: DemoCase = {
  render: () => <Hint>The operating system decides between light and dark.</Hint>,
};

export const EmptyStates: DemoCase = {
  render: () => <EmptyText>No notes yet.</EmptyText>,
};

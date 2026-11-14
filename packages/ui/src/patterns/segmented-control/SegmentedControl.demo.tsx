import { useState } from 'react';
import type { Demo, DemoMeta } from '../../../gallery/types';
import { SegmentedControl } from './SegmentedControl';

const meta = {
  title: 'Patterns/SegmentedControl',
} satisfies DemoMeta;

export default meta;
type DemoCase = Demo;

function DefaultStory() {
  const [value, setValue] = useState<'sources' | 'titles' | 'repositories'>('sources');
  return (
    <SegmentedControl
      label="Registry kind"
      value={value}
      onChange={setValue}
      options={[
        { value: 'sources', label: 'Sources' },
        { value: 'titles', label: 'Titles' },
        { value: 'repositories', label: 'Repositories' },
      ]}
    />
  );
}

export const Default: DemoCase = {
  render: () => <DefaultStory />,
};

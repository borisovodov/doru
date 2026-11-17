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

function GridStory() {
  const [value, setValue] = useState<'sources' | 'titles' | 'repositories' | 'submitters' | 'addresses'>('sources');
  return (
    <div style={{ width: 260 }}>
      <SegmentedControl
        label="Registry kind"
        columns={2}
        value={value}
        onChange={setValue}
        options={[
          { value: 'sources', label: 'Sources' },
          { value: 'titles', label: 'Titles' },
          { value: 'repositories', label: 'Repositories' },
          { value: 'submitters', label: 'Submitters' },
          { value: 'addresses', label: 'Addresses' },
        ]}
      />
    </div>
  );
}

export const Default: DemoCase = {
  render: () => <DefaultStory />,
};

export const Grid: DemoCase = {
  render: () => <GridStory />,
};

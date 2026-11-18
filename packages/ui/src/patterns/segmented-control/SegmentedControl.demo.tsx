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

function TabsStory() {
  const [value, setValue] = useState<'sources' | 'titles'>('sources');
  const tabPrefix = 'demo-registry-tab';
  const panelId = 'demo-registry-panel';
  return (
    <div style={{ width: 260 }}>
      <SegmentedControl
        label="Registry kind"
        mode="tabs"
        idPrefix={tabPrefix}
        panelId={panelId}
        value={value}
        onChange={setValue}
        options={[
          { value: 'sources', label: 'Sources' },
          { value: 'titles', label: 'Titles' },
        ]}
      />
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={`${tabPrefix}-${value}`}
        style={{ padding: 'var(--doru-space-4)', color: 'var(--doru-fg-muted)' }}
      >
        {value === 'sources' ? 'Sources panel' : 'Titles panel'}
      </div>
    </div>
  );
}

export const Tabs: DemoCase = {
  render: () => <TabsStory />,
};

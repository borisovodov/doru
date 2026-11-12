import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentedControl } from './SegmentedControl';

const meta = {
  title: 'Patterns/SegmentedControl',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
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
  },
};

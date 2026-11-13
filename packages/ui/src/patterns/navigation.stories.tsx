import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchField } from './search-field/SearchField';
import { Toolbar } from './toolbar/Toolbar';
import { Button } from '../atoms/button/Button';

const meta = {
  title: 'Patterns/Navigation',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function SearchStory() {
  const [value, setValue] = useState('');
  return <SearchField label="Search persons" value={value} onChange={setValue} />;
}

export const Search: Story = {
  render: () => <SearchStory />,
};

export const Toolbars: Story = {
  render: () => (
    <Toolbar label="Canvas actions">
      <Button size="sm" variant="secondary">
        Ancestors
      </Button>
      <Button size="sm" variant="ghost">
        Descendants
      </Button>
    </Toolbar>
  ),
};

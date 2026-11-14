import { useState } from 'react';
import type { Demo, DemoMeta } from '../../gallery/types';
import { SearchField } from './search-field/SearchField';
import { Toolbar } from './toolbar/Toolbar';
import { Button } from '../atoms/button/Button';

const meta = {
  title: 'Patterns/Navigation',
} satisfies DemoMeta;

export default meta;
type DemoCase = Demo;

function SearchStory() {
  const [value, setValue] = useState('');
  return <SearchField label="Search persons" value={value} onChange={setValue} />;
}

export const Search: DemoCase = {
  render: () => <SearchStory />,
};

export const Toolbars: DemoCase = {
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

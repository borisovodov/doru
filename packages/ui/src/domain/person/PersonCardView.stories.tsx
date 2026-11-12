import type { Meta, StoryObj } from '@storybook/react-vite';
import type { PersonRecord } from '@doru/core';
import { PersonCardView } from './PersonCardView';

const person: PersonRecord = {
  id: 'P1',
  names: [{ id: 'N1', given: 'Ivan', surname: 'Ivanov' }],
  sex: 'M',
  facts: [
    {
      id: 'F1',
      personId: 'P1',
      tag: 'BIRT',
      date: { quality: 'exact', component: { year: 1923 } },
    },
    {
      id: 'F2',
      personId: 'P1',
      tag: 'DEAT',
      date: { quality: 'exact', component: { year: 1990 } },
    },
  ],
};

const meta = {
  title: 'Domain/PersonCardView',
  component: PersonCardView,
  args: {
    person,
    line: 'paternal',
    isFocus: true,
    hasSubtree: true,
    collapsed: false,
    counts: { notes: 2, sources: 1, media: 3 },
    isDropTarget: false,
    selected: true,
  },
} satisfies Meta<typeof PersonCardView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Deceased: Story = {
  args: { isFocus: false, selected: false },
};

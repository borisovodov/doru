import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NamesSection } from './NamesSection';
import { emptyNameDraft } from './draft';

function StatefulNamesSection(args: ComponentProps<typeof NamesSection>) {
  const [names, setNames] = useState(args.names);
  return <NamesSection {...args} names={names} onChange={setNames} />;
}

const meta = {
  title: 'Domain/NamesSection',
  component: NamesSection,
  args: {
    names: [
      {
        ...emptyNameDraft(),
        type: 'birth',
        parts: [
          { id: 'N1', kind: 'given', value: 'Ivan', position: 0 },
          { id: 'N2', kind: 'surname', value: 'Ivanov', position: 1 },
        ],
      },
    ],
    onChange: () => undefined,
  },
  render: (args) => <StatefulNamesSection {...args} />,
} satisfies Meta<typeof NamesSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

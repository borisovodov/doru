import { useState, type ComponentProps } from 'react';
import type { Demo, DemoMeta } from '../../../gallery/types';
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
  render: (args) => <StatefulNamesSection {...(args as ComponentProps<typeof StatefulNamesSection>)} />,
} satisfies DemoMeta<typeof NamesSection>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { NamesSection } from './NamesSection';
import { emptyNameDraft } from './draft';

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
} satisfies Meta<typeof NamesSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

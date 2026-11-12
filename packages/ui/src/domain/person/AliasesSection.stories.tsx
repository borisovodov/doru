import type { Meta, StoryObj } from '@storybook/react-vite';
import type { PersonRecord } from '@doru/core';
import { AliasesSection } from './AliasesSection';

const persons: PersonRecord[] = [
  { id: 'P1', names: [{ id: 'N1', given: 'Ivan', surname: 'Ivanov' }], sex: 'M', facts: [] },
  { id: 'P2', names: [{ id: 'N2', given: 'Ivan', surname: 'Ivanov' }], sex: 'M', facts: [] },
];

const meta = {
  title: 'Domain/AliasesSection',
  component: AliasesSection,
  args: {
    personId: 'P1',
    aliases: [{ id: 'A1', aliasId: 'P2' }],
    persons,
    onAdd: async () => undefined,
    onDelete: async () => undefined,
  },
} satisfies Meta<typeof AliasesSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { aliases: [] },
};

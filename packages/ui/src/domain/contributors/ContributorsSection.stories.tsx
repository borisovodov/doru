import type { Meta, StoryObj } from '@storybook/react-vite';
import type { SubmitterRecord } from '@doru/core';
import { ContributorsSection } from './ContributorsSection';

const submitters: SubmitterRecord[] = [
  { id: 'S1', name: 'Ivan Petrov' },
  { id: 'S2', name: 'Maria Ivanova' },
];

const meta = {
  title: 'Domain/ContributorsSection',
  component: ContributorsSection,
  args: {
    targetType: 'person',
    targetId: 'P1',
    submitters,
    links: [{ id: 'L1', submitterId: 'S1', targetType: 'person', targetId: 'P1' }],
    onAdd: async () => undefined,
    onDelete: async () => undefined,
  },
} satisfies Meta<typeof ContributorsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { links: [] },
};

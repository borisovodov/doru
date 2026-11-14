import type { Demo, DemoMeta } from '../../../gallery/types';
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
} satisfies DemoMeta<typeof ContributorsSection>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const Empty: DemoCase = {
  args: { links: [] },
};

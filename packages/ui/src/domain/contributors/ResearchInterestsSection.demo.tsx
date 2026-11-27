import type { Demo, DemoMeta } from '../../../gallery/types';
import type { SubmitterRecord } from '@doru/core';
import { ResearchInterestsSection } from './ResearchInterestsSection';

const submitters: SubmitterRecord[] = [
  { id: 'S1', name: 'Ivan Petrov' },
  { id: 'S2', name: 'Maria Ivanova' },
];

const meta = {
  title: 'Domain/ResearchInterestsSection',
  component: ResearchInterestsSection,
  args: {
    targetType: 'person',
    targetId: 'P1',
    submitters,
    links: [
      { id: 'L1', submitterId: 'S1', targetType: 'person', targetId: 'P1', kind: 'ancestor_interest' },
      { id: 'L2', submitterId: 'S2', targetType: 'person', targetId: 'P1', kind: 'descendant_interest' },
    ],
    onAdd: async () => undefined,
    onDelete: async () => undefined,
  },
} satisfies DemoMeta<typeof ResearchInterestsSection>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const Empty: DemoCase = {
  args: { links: [] },
};

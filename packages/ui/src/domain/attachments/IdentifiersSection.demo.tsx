import type { Demo, DemoMeta } from '../../../gallery/types';
import type { IdentifierRecord } from '@doru/core';
import { IdentifiersSection } from './AttachmentsSection';

const noop = async () => undefined;

const identifiers: IdentifierRecord[] = [
  {
    id: 'I1',
    targetType: 'person',
    targetId: 'P1',
    namespace: 'refn',
    type: 'civil',
    value: 'IV-1908',
  },
  {
    id: 'I2',
    targetType: 'person',
    targetId: 'P1',
    namespace: 'sosa',
    value: '42',
  },
];

const meta = {
  title: 'Domain/IdentifiersSection',
  component: IdentifiersSection,
  args: {
    targetType: 'person',
    targetId: 'P1',
    identifiers,
    onAdd: noop,
    onUpdate: async () => undefined,
    onDelete: noop,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360, padding: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies DemoMeta<typeof IdentifiersSection>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const Empty: DemoCase = {
  args: { identifiers: [] },
};

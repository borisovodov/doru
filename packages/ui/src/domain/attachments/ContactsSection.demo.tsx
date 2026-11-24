import type { Demo, DemoMeta } from '../../../gallery/types';
import type { ContactRecord } from '@doru/core';
import { ContactsSection } from './AttachmentsSection';

const noop = async () => undefined;

const contacts: ContactRecord[] = [
  {
    id: 'C1',
    targetType: 'person',
    targetId: 'P1',
    kind: 'email',
    value: 'anna@example.org',
  },
  {
    id: 'C2',
    targetType: 'person',
    targetId: 'P1',
    kind: 'phone',
    value: '+7 4872 12-34-56',
  },
];

const meta = {
  title: 'Domain/ContactsSection',
  component: ContactsSection,
  args: {
    targetType: 'person',
    targetId: 'P1',
    contacts,
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
} satisfies DemoMeta<typeof ContactsSection>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const Empty: DemoCase = {
  args: { contacts: [] },
};

export const UnknownKind: DemoCase = {
  args: {
    contacts: [
      {
        id: 'C3',
        targetType: 'person',
        targetId: 'P1',
        kind: 'telegram',
        value: '@anna_ivanova',
      },
    ],
  },
};

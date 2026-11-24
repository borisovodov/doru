import type { Demo, DemoMeta } from '../../../gallery/types';
import type { NoteRecord } from '@doru/core';
import { NotesSection } from './NotesSection';

const noop = async () => undefined;

const note: NoteRecord = {
  id: 'N1',
  text: 'The family moved to Tula around 1905.',
  targetType: 'person',
  targetId: 'P1',
  language: 'en',
};

const sharedNote: NoteRecord = {
  id: 'N2',
  text: 'The 1890 register is water-damaged; compare with the 1905 copy.',
  links: [
    { id: 'NL1', targetType: 'person', targetId: 'P1' },
    { id: 'NL2', targetType: 'person', targetId: 'P2' },
  ],
};

const meta = {
  title: 'Domain/NotesSection',
  component: NotesSection,
  args: {
    targetType: 'person',
    targetId: 'P1',
    notes: [note],
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
} satisfies DemoMeta<typeof NotesSection>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const Empty: DemoCase = {
  args: { notes: [] },
};

export const Shared: DemoCase = {
  args: { notes: [sharedNote] },
};

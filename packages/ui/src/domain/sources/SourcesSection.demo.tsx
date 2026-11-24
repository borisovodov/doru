import type { Demo, DemoMeta } from '../../../gallery/types';
import type { SourceRecord } from '@doru/core';
import { SourcesSection } from './SourcesSection';

const noop = async () => undefined;

const cited: SourceRecord = {
  id: 'S1',
  title: 'Ivanovka parish register, 1890–1910',
  author: 'Tula State Archive',
};

const uncited: SourceRecord = {
  id: 'S2',
  title: 'Tula province census, 1897',
  author: 'Tula State Archive',
};

const meta = {
  title: 'Domain/SourcesSection',
  component: SourcesSection,
  args: {
    targetType: 'person',
    targetId: 'P1',
    sources: [cited, uncited],
    citations: [{ id: 'C1', sourceId: cited.id, targetType: 'person', targetId: 'P1', page: 'p. 42' }],
    refresh: noop,
    onAddSource: noop,
    onAttachSource: noop,
    onDetachCitation: noop,
    onUpdateCitation: async () => undefined,
    onOpenSource: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360, padding: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies DemoMeta<typeof SourcesSection>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const Empty: DemoCase = {
  args: { sources: [], citations: [] },
};

export const OnlyCited: DemoCase = {
  args: { sources: [cited], citations: [{ id: 'C1', sourceId: cited.id, targetType: 'person', targetId: 'P1' }] },
};

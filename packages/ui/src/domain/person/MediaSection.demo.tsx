import type { Demo, DemoMeta } from '../../../gallery/types';
import type { MediaWithPath } from './types';
import { MediaSection } from './MediaSection';

const noop = async () => undefined;

const scan: MediaWithPath = {
  id: 'M1',
  title: 'Ivanovka register scan',
  path: 'media/ivanovka-register-scan.pdf',
  absolutePath: '/demo/ivanovka-register-scan.pdf',
};

const portrait: MediaWithPath = {
  id: 'M2',
  title: 'Portrait of Anna Ivanova',
  path: 'media/anna-portrait.pdf',
  absolutePath: '/demo/anna-portrait.pdf',
  links: [
    {
      id: 'ML1',
      mediaId: 'M2',
      targetType: 'person',
      targetId: 'P1',
      primary: true,
    },
    {
      id: 'ML3',
      mediaId: 'M2',
      targetType: 'place',
      targetId: 'PL1',
    },
  ],
};

const document: MediaWithPath = {
  id: 'M3',
  title: 'Damaged duplicate',
  path: 'media/damaged-duplicate.pdf',
  absolutePath: '/demo/damaged-duplicate.pdf',
  links: [
    {
      id: 'ML2',
      mediaId: 'M3',
      targetType: 'person',
      targetId: 'P1',
    },
  ],
};

const api = {
  getMediaFor: async () => [],
  getAllMedia: async () => [scan],
  addMediaToTarget: noop,
  addMediaUrlToTarget: noop,
  attachMedia: noop,
  detachMedia: noop,
  deleteMedia: noop,
};

const meta = {
  title: 'Domain/MediaSection',
  component: MediaSection,
  args: {
    targetType: 'person',
    targetId: 'P1',
    media: [scan],
    api,
    refresh: noop,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360, padding: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies DemoMeta<typeof MediaSection>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const Empty: DemoCase = {
  args: { media: [], api: { ...api, getAllMedia: async () => [] } },
};

export const PrimaryAndExcluded: DemoCase = {
  args: {
    media: [portrait, document],
    api: { ...api, getAllMedia: async () => [portrait, document] },
  },
};

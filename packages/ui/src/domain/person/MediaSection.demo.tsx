import type { Demo, DemoMeta } from '../../../gallery/types';
import type { MediaWithPath } from './types';
import { MediaSection } from './MediaSection';

const noop = async () => undefined;

const scan: MediaWithPath = {
  id: 'M1',
  title: 'Ivanovka register scan',
  path: 'media/ivanovka-register-scan.pdf',
  absolutePath: '/demo/ivanovka-register-scan.pdf',
  files: [
    {
      id: 'MF1',
      path: 'media/ivanovka-register-scan.pdf',
      absolutePath: '/demo/ivanovka-register-scan.pdf',
      title: 'Page 42',
    },
  ],
};

const portrait: MediaWithPath = {
  id: 'M2',
  title: 'Portrait of Anna Ivanova',
  path: 'media/anna-portrait.pdf',
  absolutePath: '/demo/anna-portrait.pdf',
  files: [
    {
      id: 'MF2',
      path: 'media/anna-portrait.pdf',
      absolutePath: '/demo/anna-portrait.pdf',
    },
  ],
  links: [
    {
      id: 'ML1',
      mediaId: 'M2',
      targetType: 'person',
      targetId: 'P1',
      primary: true,
    },
  ],
};

const excluded: MediaWithPath = {
  id: 'M3',
  title: 'Damaged duplicate',
  path: 'media/damaged-duplicate.pdf',
  absolutePath: '/demo/damaged-duplicate.pdf',
  files: [
    {
      id: 'MF3',
      path: 'media/damaged-duplicate.pdf',
      absolutePath: '/demo/damaged-duplicate.pdf',
    },
  ],
  links: [
    {
      id: 'ML2',
      mediaId: 'M3',
      targetType: 'person',
      targetId: 'P1',
      exclude: true,
    },
  ],
};

const api = {
  getMediaFor: async () => [],
  getAllMedia: async () => [scan],
  addMediaToTarget: noop,
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
    media: [portrait, excluded],
    api: { ...api, getAllMedia: async () => [portrait, excluded] },
  },
};

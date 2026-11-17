import type { Demo, DemoMeta } from '../../../gallery/types';
import { BookOpenText, StickyNote } from 'lucide-react';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Chip } from './Chip';
import { Divider } from './Divider';
import { Kbd } from './Kbd';
import { MetadataText } from './MetadataText';

const meta = {
  title: 'Atoms/Display',
} satisfies DemoMeta;

export default meta;
type DemoCase = Demo;

export const Avatars: DemoCase = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Avatar initials="II" tone="male" />
      <Avatar initials="MI" tone="female" />
      <Avatar initials="UN" tone="neutral" shape="circle" />
      <Avatar initials="SM" size="sm" />
      <Avatar initials="LG" size="lg" />
    </div>
  ),
};

export const Chips: DemoCase = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Chip>BIRT</Chip>
      <Chip variant="neutral">1923</Chip>
    </div>
  ),
};

export const Badges: DemoCase = {
  render: () => (
    <div style={{ display: 'flex', gap: 12 }}>
      <Badge icon={<StickyNote size={12} />}>3</Badge>
      <Badge icon={<BookOpenText size={12} />}>2</Badge>
    </div>
  ),
};

export const Keys: DemoCase = {
  render: () => (
    <div style={{ display: 'flex', gap: 4 }}>
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </div>
  ),
};

export const Metadata: DemoCase = {
  render: () => <MetadataText>JPEG · 2.4 MB · 1920 × 1080</MetadataText>,
};

export const Dividers: DemoCase = {
  render: () => (
    <div style={{ maxWidth: 240 }}>
      <p>Above</p>
      <Divider />
      <p>Below</p>
    </div>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ChangeRecord } from '@doru/core';
import { ChangesSection } from './ChangesSection';
import { MediaSection } from './MediaSection';

const meta = {
  title: 'Domain/Person sections',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const changes: ChangeRecord[] = [
  {
    id: 'C1',
    kind: 'created',
    targetType: 'person',
    targetId: 'P1',
    date: { quality: 'exact', component: { year: 2024 } },
    user: 'Ivan',
  },
  {
    id: 'C2',
    kind: 'changed',
    targetType: 'person',
    targetId: 'P1',
    date: { quality: 'exact', component: { year: 2025 } },
  },
];

export const ChangeLog: Story = {
  render: () => <ChangesSection changes={changes} />,
};

export const Media: Story = {
  render: () => (
    <MediaSection
      personId="P1"
      media={[
        {
          id: 'M1',
          title: 'Portrait',
          path: 'portrait.jpg',
          absolutePath: '/photos/portrait.jpg',
        },
      ]}
      refresh={async () => undefined}
      onAddMedia={async () => undefined}
      onDeleteMedia={async () => undefined}
    />
  ),
};

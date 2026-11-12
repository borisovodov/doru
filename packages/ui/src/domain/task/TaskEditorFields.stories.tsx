import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import { TaskEditorFields } from './TaskEditorFields';
import { emptyTodoDraft } from './todoDraft';

function StatefulTaskEditorFields(args: ComponentProps<typeof TaskEditorFields>) {
  const [edit, setEdit] = useState(args.edit);
  return (
    <SectionCard title="Details">
      <TaskEditorFields
        {...args}
        edit={edit}
        onChange={(update) => setEdit((current) => ({ ...current, ...update }))}
      />
    </SectionCard>
  );
}

const meta = {
  title: 'Domain/TaskEditorFields',
  component: TaskEditorFields,
  args: {
    edit: { ...emptyTodoDraft(), text: 'Find the parish register' },
    persons: [],
    repositories: [],
    onChange: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 260, padding: 12 }}>
        <Story />
      </div>
    ),
  ],
  render: (args) => <StatefulTaskEditorFields {...args} />,
} satisfies Meta<typeof TaskEditorFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { PersonCardEditor } from './PersonCardEditor';

const meta = {
  title: 'Domain/PersonCardEditor',
  component: PersonCardEditor,
  args: {
    onSave: () => undefined,
    onCancel: () => undefined,
    autoFocus: false,
  },
} satisfies Meta<typeof PersonCardEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

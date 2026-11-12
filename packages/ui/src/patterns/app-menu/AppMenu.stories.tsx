import type { Meta, StoryObj } from '@storybook/react-vite';
import { CommandService } from '@doru/platform';
import { AppMenu } from './AppMenu';

const meta = {
  title: 'Patterns/AppMenu',
  component: AppMenu,
  args: {
    commands: new CommandService(),
    platform: 'win32',
    onMenuAction: () => undefined,
  },
} satisfies Meta<typeof AppMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

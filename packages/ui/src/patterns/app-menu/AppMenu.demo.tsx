import type { Demo, DemoMeta } from '../../../gallery/types';
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
} satisfies DemoMeta<typeof AppMenu>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

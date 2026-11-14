import type { Demo, DemoMeta } from '../../../gallery/types';
import { PersonCardEditor } from './PersonCardEditor';

const meta = {
  title: 'Domain/PersonCardEditor',
  component: PersonCardEditor,
  args: {
    onSave: () => undefined,
    onCancel: () => undefined,
    autoFocus: false,
  },
} satisfies DemoMeta<typeof PersonCardEditor>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

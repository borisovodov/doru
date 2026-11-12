import type { Meta, StoryObj } from '@storybook/react-vite';
import type { PersonRecord } from '@doru/core';
import { TreeToolbar } from './TreeToolbar';

const persons: PersonRecord[] = [
  { id: 'P1', names: [{ id: 'N1', given: 'Ivan', surname: 'Ivanov' }], sex: 'M', facts: [] },
  { id: 'P2', names: [{ id: 'N2', given: 'Maria', surname: 'Ivanova' }], sex: 'F', facts: [] },
];

const meta = {
  title: 'Domain/TreeToolbar',
  component: TreeToolbar,
  args: {
    kind: 'ancestors',
    onKindChange: () => undefined,
    canGoBack: true,
    canGoForward: false,
    onBack: () => undefined,
    onForward: () => undefined,
    onCollapseAll: () => undefined,
    onExpandAll: () => undefined,
    breadcrumbs: ['P1', 'P2'],
    focusPersonId: 'P2',
    persons,
    onJump: () => undefined,
  },
} satisfies Meta<typeof TreeToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

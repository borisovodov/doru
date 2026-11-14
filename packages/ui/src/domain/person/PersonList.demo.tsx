import type { Demo, DemoMeta } from '../../../gallery/types';
import type { PersonRecord } from '@doru/core';
import { PersonList } from './PersonList';

const persons: PersonRecord[] = [
  { id: 'P1', names: [{ id: 'N1', given: 'Ivan', surname: 'Ivanov' }], sex: 'M', facts: [] },
  { id: 'P2', names: [{ id: 'N2', given: 'Maria', surname: 'Ivanova' }], sex: 'F', facts: [] },
  { id: 'P3', names: [{ id: 'N3', given: 'Petr', surname: 'Ivanov' }], sex: 'M', facts: [] },
];

const meta = {
  title: 'Domain/PersonList',
  component: PersonList,
  args: { persons, onOpen: () => undefined },
  decorators: [
    (Story) => (
      <div style={{ width: 260, padding: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies DemoMeta<typeof PersonList>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

import type { Demo, DemoMeta } from '../../../gallery/types';
import type { PersonRecord } from '@doru/core';
import { AssociationsSection } from './AssociationsSection';

const persons: PersonRecord[] = [
  { id: 'P1', names: [{ id: 'N1', given: 'Ivan', surname: 'Ivanov' }], sex: 'M', facts: [] },
  { id: 'P2', names: [{ id: 'N2', given: 'Peter', surname: 'Ivanov' }], sex: 'M', facts: [] },
];

const meta = {
  title: 'Domain/AssociationsSection',
  component: AssociationsSection,
  args: {
    personId: 'P1',
    associations: [
      {
        id: 'A1',
        personId: 'P1',
        otherPersonId: 'P2',
        relationship: 'godfather',
        role: 'witness',
      },
    ],
    persons,
    onAdd: async () => undefined,
    onUpdate: async () => undefined,
    onDelete: async () => undefined,
  },
} satisfies DemoMeta<typeof AssociationsSection>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

export const Empty: DemoCase = {
  args: { associations: [] },
};

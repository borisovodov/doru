import type { Meta, StoryObj } from '@storybook/react-vite';
import { AddressFields } from './AddressFields';
import { emptyAddressDraft } from './address';

const meta = {
  title: 'Domain/AddressFields',
  component: AddressFields,
  args: {
    address: { ...emptyAddressDraft(), city: 'Ivanovka', country: 'Russia' },
    onChange: () => undefined,
  },
} satisfies Meta<typeof AddressFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

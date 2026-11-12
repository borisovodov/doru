import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AddressFields } from './AddressFields';
import { emptyAddressDraft } from './address';

function StatefulAddressFields(args: ComponentProps<typeof AddressFields>) {
  const [address, setAddress] = useState(args.address);
  return <AddressFields {...args} address={address} onChange={setAddress} />;
}

const meta = {
  title: 'Domain/AddressFields',
  component: AddressFields,
  args: {
    address: { ...emptyAddressDraft(), city: 'Ivanovka', country: 'Russia' },
    onChange: () => undefined,
  },
  render: (args) => <StatefulAddressFields {...args} />,
} satisfies Meta<typeof AddressFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

import { useState, type ComponentProps } from 'react';
import type { Demo, DemoMeta } from '../../../gallery/types';
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
  render: (args) => <StatefulAddressFields {...(args as ComponentProps<typeof StatefulAddressFields>)} />,
} satisfies DemoMeta<typeof AddressFields>;

export default meta;
type DemoCase = Demo;

export const Default: DemoCase = {};

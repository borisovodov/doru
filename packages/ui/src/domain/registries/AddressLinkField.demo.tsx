import { useState, type ComponentProps } from 'react';
import type { AddressRecord } from '@doru/core';
import type { Demo, DemoMeta } from '../../../gallery/types';
import { AddressLinkField } from './AddressLinkField';
import { addressToDraft, emptyAddressDraft } from './address';

const addresses: AddressRecord[] = [
  { id: 'A1', lines: ['12 Archive Lane'], city: 'Moscow', postalCode: '101000', country: 'Russia' },
  { id: 'A2', lines: ['3 Library Street'], city: 'Tver', country: 'Russia' },
];

const firstAddress = addresses[0];

function StatefulAddressLinkField(args: ComponentProps<typeof AddressLinkField>) {
  const [addressId, setAddressId] = useState(args.addressId);
  const [address, setAddress] = useState(args.address);
  return (
    <AddressLinkField
      {...args}
      addressId={addressId}
      address={address}
      onSelect={(next) => {
        setAddressId(next);
        const record = addresses.find((entry) => entry.id === next);
        setAddress(record !== undefined ? addressToDraft(record) : emptyAddressDraft());
      }}
      onChange={setAddress}
    />
  );
}

const meta = {
  title: 'Domain/AddressLinkField',
  component: AddressLinkField,
  args: {
    addresses,
    addressId: 'A1',
    address: firstAddress !== undefined ? addressToDraft(firstAddress) : emptyAddressDraft(),
    onSelect: () => undefined,
    onChange: () => undefined,
    onOpen: () => undefined,
  },
  render: (args) => <StatefulAddressLinkField {...(args as ComponentProps<typeof StatefulAddressLinkField>)} />,
} satisfies DemoMeta<typeof AddressLinkField>;

export default meta;
type DemoCase = Demo;

export const Linked: DemoCase = {};
export const New: DemoCase = { args: { addressId: undefined } };

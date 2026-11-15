import type { AddressRecord } from '@doru/core';
import { nls } from '../../nls';
import { Button } from '../../atoms/button/Button';
import { Field } from '../../atoms/field/Field';
import { Select } from '../../atoms/form/Select';
import { AddressFields } from './AddressFields';
import { addressLabel, type AddressDraft } from './address';
import styles from './AddressLinkField.module.css';

/**
 * The address block of the repository/submitter editors. A linked address is
 * read-only here — it is edited in its own Address tab; the form is shown
 * only for a new address.
 */
export function AddressLinkField({
  addresses,
  addressId,
  address,
  onSelect,
  onChange,
  onOpen,
}: {
  addresses: AddressRecord[];
  addressId: string | undefined;
  address: AddressDraft;
  onSelect: (addressId: string | undefined) => void;
  onChange: (draft: AddressDraft) => void;
  onOpen?: ((addressId: string) => void) | undefined;
}) {
  const linked = addressId !== undefined ? addresses.find((entry) => entry.id === addressId) : undefined;
  return (
    <>
      <Field label={nls.t('features.tree.address.title')}>
        <Select value={addressId ?? ''} onChange={(event) => onSelect(event.target.value || undefined)}>
          <option value="">{nls.t('features.tree.address.newAddress')}</option>
          {addresses.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {addressLabel(entry)}
            </option>
          ))}
        </Select>
      </Field>
      {addressId !== undefined ? (
        <div className={styles['linked']}>
          <p className={styles['summary']}>{linked !== undefined ? addressLabel(linked) : addressId}</p>
          <div className={styles['actions']}>
            {onOpen !== undefined && (
              <Button variant="secondary" size="sm" onClick={() => onOpen(addressId)}>
                {nls.t('features.tree.address.open')}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => onSelect(undefined)}>
              {nls.t('features.tree.address.unlink')}
            </Button>
          </div>
        </div>
      ) : (
        <AddressFields address={address} onChange={onChange} />
      )}
    </>
  );
}

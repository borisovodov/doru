import { useEffect, useState } from 'react';
import type { AddressRecord } from '@doru/core';
import type { RegistriesEditorApi } from '@doru/features';
import {
  addressDraftEmpty,
  addressDraftToRecord,
  addressToDraft,
  emptyAddressDraft,
  type AddressDraft,
} from '@doru/ui/domain';

/**
 * The address sub-form state shared by the repository and submitter tabs:
 * loads the stored address (if any) and saves it on demand, returning the
 * address id to store on the owning record (or undefined when cleared).
 */
export function useRegistryAddress(api: RegistriesEditorApi, addressId: string | undefined) {
  const [address, setAddress] = useState<AddressDraft>(emptyAddressDraft());
  const [addressLoaded, setAddressLoaded] = useState(false);
  const [addressBefore, setAddressBefore] = useState<AddressRecord | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (addressId !== undefined) {
      void api.getAddress(addressId).then((loaded) => {
        if (!cancelled && loaded) {
          setAddress(addressToDraft(loaded));
          setAddressBefore(loaded);
          setAddressLoaded(true);
        }
      });
    } else {
      setAddressLoaded(true);
    }
    return () => {
      cancelled = true;
    };
  }, [addressId, api]);

  /** Persists the address and returns the id for the owning record. */
  const saveAddress = async (): Promise<string | undefined> => {
    if (!addressLoaded) {
      return addressId;
    }
    if (addressDraftEmpty(address)) {
      if (addressBefore) {
        await api.deleteAddress(addressBefore);
        setAddressBefore(undefined);
      }
      return undefined;
    }
    const record = addressDraftToRecord(address);
    if (addressBefore) {
      await api.updateAddress(addressBefore, record);
    } else {
      await api.addAddress(record);
    }
    setAddress((current) => ({ ...current, id: record.id }));
    setAddressBefore(record);
    return record.id;
  };

  return { address, setAddress, addressLoaded, saveAddress };
}

import { useEffect, useRef, useState } from 'react';
import type { AddressRecord } from '@doru/core';
import type { RegistriesEditorApi } from '../person/types';
import {
  addressDraftEmpty,
  addressDraftToRecord,
  addressToDraft,
  emptyAddressDraft,
  type AddressDraft,
} from '@doru/ui/domain';

/**
 * The address sub-form state shared by the repository and submitter tabs.
 *
 * A linked address (`addressId` set) is read-only in these editors and is
 * loaded for the summary; a new address keeps its editable draft. Unlinking
 * only clears the draft/link — the AddressRecord itself is never deleted
 * here, because it may be shared with other records.
 */
export function useRegistryAddress(api: RegistriesEditorApi, addressId: string | undefined) {
  const [address, setAddress] = useState<AddressDraft>(emptyAddressDraft());
  const [addressLoaded, setAddressLoaded] = useState(false);
  const [addressBefore, setAddressBefore] = useState<AddressRecord | undefined>(undefined);
  const apiRef = useRef(api);
  apiRef.current = api;

  useEffect(() => {
    let cancelled = false;
    if (addressId !== undefined) {
      void apiRef.current.getAddress(addressId).then((loaded) => {
        if (!cancelled) {
          if (loaded) {
            setAddress(addressToDraft(loaded));
            setAddressBefore(loaded);
          } else {
            setAddress(emptyAddressDraft());
            setAddressBefore(undefined);
          }
          setAddressLoaded(true);
        }
      });
    } else {
      setAddress(emptyAddressDraft());
      setAddressBefore(undefined);
      setAddressLoaded(true);
    }
    return () => {
      cancelled = true;
    };
  }, [addressId]);

  /** Persists a new/edited private address and returns the id to store. */
  const saveAddress = async (): Promise<string | undefined> => {
    if (!addressLoaded) {
      return addressId;
    }
    if (addressDraftEmpty(address)) {
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

  /** Clears the local draft after the owner drops its address link. */
  const unlinkAddress = () => {
    setAddress(emptyAddressDraft());
    setAddressBefore(undefined);
    setAddressLoaded(true);
  };

  return { address, setAddress, addressLoaded, addressBefore, saveAddress, unlinkAddress };
}

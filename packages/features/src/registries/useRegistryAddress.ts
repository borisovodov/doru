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

/** An empty address draft whose first line carries the tab's default title. */
function emptyAddressDraftWithLine(line: string): AddressDraft {
  const draft = emptyAddressDraft();
  const first = draft.lines[0];
  return first === undefined || line === ''
    ? draft
    : { ...draft, lines: [{ ...first, value: line }, ...draft.lines.slice(1)] };
}

/**
 * The address sub-form state shared by the repository and submitter tabs.
 *
 * A linked address (`addressId` set) is read-only in these editors and is
 * loaded for the summary; a new address keeps its editable draft. Unlinking
 * only clears the draft/link — the AddressRecord itself is never deleted
 * here, because it may be shared with other records.
 */
export function useRegistryAddress(api: RegistriesEditorApi, addressId: string | undefined, defaultLine = '') {
  const defaultLineRef = useRef(defaultLine);
  const [address, setAddress] = useState<AddressDraft>(() => emptyAddressDraftWithLine(defaultLineRef.current));
  const [addressLoaded, setAddressLoaded] = useState(false);
  const [addressBefore, setAddressBefore] = useState<AddressRecord | undefined>(undefined);
  const [addressSaveFailed, setAddressSaveFailed] = useState(false);
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
            setAddress(emptyAddressDraftWithLine(defaultLineRef.current));
            setAddressBefore(undefined);
          }
          setAddressLoaded(true);
        }
      });
    } else {
      setAddress(emptyAddressDraftWithLine(defaultLineRef.current));
      setAddressBefore(undefined);
      setAddressLoaded(true);
    }
    setAddressSaveFailed(false);
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
    const submitted = address;
    const record = addressDraftToRecord(submitted);
    if (addressBefore) {
      try {
        await api.updateAddress(addressBefore, record);
      } catch (error) {
        setAddressSaveFailed(true);
        // The stored address may have been deleted since it was loaded. Drop
        // the stale baseline so a retry recreates the row instead of calling
        // the same doomed update forever. A failed diagnostic lookup must not
        // replace the original save error.
        try {
          const checkedId = addressBefore.id;
          if ((await api.getAddress(checkedId)) === undefined) {
            setAddressBefore((current) => (current?.id === checkedId ? undefined : current));
          }
        } catch {
          // The diagnostic is best effort; keep the stale baseline.
        }
        throw error;
      }
    } else {
      try {
        await api.addAddress(record);
      } catch (error) {
        setAddressSaveFailed(true);
        throw error;
      }
    }
    setAddressSaveFailed(false);
    const idBySubmittedIndex = new Map<number, string>();
    let storedIndex = 0;
    submitted.lines.forEach((line, index) => {
      if (line.value.trim() === '') {
        return;
      }
      const stored = record.lines[storedIndex];
      storedIndex += 1;
      if (stored !== undefined) {
        idBySubmittedIndex.set(index, stored.id);
      }
    });
    setAddress((current) => {
      const linesUnchanged =
        current.lines.length === submitted.lines.length &&
        current.lines.every((line, index) => line.value === submitted.lines[index]?.value);
      return {
        ...current,
        id: record.id,
        lines: linesUnchanged
          ? current.lines.map((line, index) => {
              const id = idBySubmittedIndex.get(index);
              return id === undefined ? line : { ...line, id };
            })
          : current.lines,
      };
    });
    setAddressBefore(record);
    return record.id;
  };

  /** Clears the local draft after the owner drops its address link. */
  const unlinkAddress = () => {
    setAddress(emptyAddressDraftWithLine(defaultLineRef.current));
    setAddressBefore(undefined);
    setAddressLoaded(true);
  };

  const clearAddressSaveFailure = () => setAddressSaveFailed(false);

  return {
    address,
    setAddress,
    addressLoaded,
    addressBefore,
    addressSaveFailed,
    saveAddress,
    unlinkAddress,
    clearAddressSaveFailure,
  };
}

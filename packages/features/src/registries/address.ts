import type { AddressRecord } from '@doru/core';

/** An editable address: address lines plus the fixed fields. */
export interface AddressDraft {
  id: string | undefined; // undefined = no stored address yet
  lines: string[];
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export function emptyAddressDraft(): AddressDraft {
  return { id: undefined, lines: [''], city: '', state: '', postalCode: '', country: '' };
}

export function addressToDraft(address: AddressRecord): AddressDraft {
  return {
    id: address.id,
    lines: address.lines.length > 0 ? [...address.lines] : [''],
    city: address.city ?? '',
    state: address.state ?? '',
    postalCode: address.postalCode ?? '',
    country: address.country ?? '',
  };
}

export function addressDraftEmpty(draft: AddressDraft): boolean {
  return (
    draft.lines.every((line) => line.trim() === '') &&
    draft.city.trim() === '' &&
    draft.state.trim() === '' &&
    draft.postalCode.trim() === '' &&
    draft.country.trim() === ''
  );
}

export function addressDraftToRecord(draft: AddressDraft): AddressRecord {
  return {
    id: draft.id ?? crypto.randomUUID(),
    lines: draft.lines.map((line) => line.trim()).filter((line) => line !== ''),
    ...(draft.city.trim() !== '' ? { city: draft.city.trim() } : {}),
    ...(draft.state.trim() !== '' ? { state: draft.state.trim() } : {}),
    ...(draft.postalCode.trim() !== '' ? { postalCode: draft.postalCode.trim() } : {}),
    ...(draft.country.trim() !== '' ? { country: draft.country.trim() } : {}),
  };
}

/** The display form of an address: lines, then city/state/zip/country. */
export function addressLabel(address: AddressRecord | undefined): string {
  if (!address) {
    return '';
  }
  return [
    ...address.lines,
    [address.city, address.state, address.postalCode].filter((part) => part !== undefined).join(' '),
    address.country,
  ]
    .filter((part) => part !== undefined && part !== '')
    .join(', ');
}

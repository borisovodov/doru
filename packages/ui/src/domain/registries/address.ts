import type { AddressRecord } from '@doru/core';

/** One editable address line; the id keeps the stored row addressable. */
export interface AddressLineDraft {
  id: string | undefined; // undefined = not stored yet
  value: string;
}

/** An editable address: address lines plus the fixed fields. */
export interface AddressDraft {
  id: string | undefined; // undefined = no stored address yet
  lines: AddressLineDraft[];
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export function emptyAddressDraft(): AddressDraft {
  return { id: undefined, lines: [{ id: undefined, value: '' }], city: '', state: '', postalCode: '', country: '' };
}

export function addressToDraft(address: AddressRecord): AddressDraft {
  return {
    id: address.id,
    lines:
      address.lines.length > 0
        ? address.lines.map((line) => ({ id: line.id, value: line.value }))
        : [{ id: undefined, value: '' }],
    city: address.city ?? '',
    state: address.state ?? '',
    postalCode: address.postalCode ?? '',
    country: address.country ?? '',
  };
}

export function addressDraftEmpty(draft: AddressDraft): boolean {
  return (
    draft.lines.every((line) => line.value.trim() === '') &&
    draft.city.trim() === '' &&
    draft.state.trim() === '' &&
    draft.postalCode.trim() === '' &&
    draft.country.trim() === ''
  );
}

/** True when the draft holds the same address values as the stored record. */
export function addressDraftMatches(draft: AddressDraft, address: AddressRecord): boolean {
  const next = addressDraftToRecord(draft);
  return (
    next.lines.length === address.lines.length &&
    next.lines.every((line, index) => line.value === address.lines[index]?.value) &&
    (next.city ?? '') === (address.city ?? '') &&
    (next.state ?? '') === (address.state ?? '') &&
    (next.postalCode ?? '') === (address.postalCode ?? '') &&
    (next.country ?? '') === (address.country ?? '')
  );
}

export function addressDraftToRecord(draft: AddressDraft): AddressRecord {
  return {
    id: draft.id ?? crypto.randomUUID(),
    lines: draft.lines
      .map((line) => ({ id: line.id ?? crypto.randomUUID(), value: line.value.trim() }))
      .filter((line) => line.value !== ''),
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
    ...address.lines.map((line) => line.value),
    [address.city, address.state, address.postalCode].filter((part) => part !== undefined).join(' '),
    address.country,
  ]
    .filter((part) => part !== undefined && part !== '')
    .join(', ');
}

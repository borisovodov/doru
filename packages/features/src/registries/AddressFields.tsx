import { Plus } from 'lucide-react';
import { nls } from '../nls';
import type { AddressDraft } from '@doru/ui';
import './registries.css';

/** The address sub-form shared by the repository and submitter editors. */
export function AddressFields({
  address,
  onChange,
}: {
  address: AddressDraft;
  onChange: (draft: AddressDraft) => void;
}) {
  const set = (patch: Partial<AddressDraft>) => onChange({ ...address, ...patch });
  const patchLine = (index: number, value: string) =>
    set({ lines: address.lines.map((line, i) => (i === index ? value : line)) });

  return (
    <div className="registry-address">
      <h4>{nls.t('features.tree.address.title')}</h4>
      {address.lines.map((line, index) => (
        <input
          key={index}
          placeholder={nls.t('features.tree.address.line')}
          value={line}
          onChange={(event) => patchLine(index, event.target.value)}
        />
      ))}
      <button className="add-button small" onClick={() => set({ lines: [...address.lines, ''] })}>
        <Plus size={13} aria-hidden="true" />
        {nls.t('features.tree.address.addLine')}
      </button>
      <div className="registry-address-grid">
        <input
          placeholder={nls.t('features.tree.address.city')}
          value={address.city}
          onChange={(event) => set({ city: event.target.value })}
        />
        <input
          placeholder={nls.t('features.tree.address.state')}
          value={address.state}
          onChange={(event) => set({ state: event.target.value })}
        />
        <input
          placeholder={nls.t('features.tree.address.postalCode')}
          value={address.postalCode}
          onChange={(event) => set({ postalCode: event.target.value })}
        />
        <input
          placeholder={nls.t('features.tree.address.country')}
          value={address.country}
          onChange={(event) => set({ country: event.target.value })}
        />
      </div>
    </div>
  );
}

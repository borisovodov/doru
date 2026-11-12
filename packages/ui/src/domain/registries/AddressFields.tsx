import { Plus } from 'lucide-react';
import { nls } from '../../nls';
import { Button } from '../../atoms/button/Button';
import { Field } from '../../atoms/field/Field';
import { FieldGrid } from '../../atoms/field-grid/FieldGrid';
import { Input } from '../../atoms/form/Input';
import { Subcard } from '../../patterns/subcard/Subcard';
import type { AddressDraft } from './address';
import styles from './AddressFields.module.css';

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
    <Subcard>
      <h4 className={styles['title']}>{nls.t('features.tree.address.title')}</h4>
      {address.lines.map((line, index) => (
        <Input
          key={index}
          aria-label={nls.t('features.tree.address.line')}
          placeholder={nls.t('features.tree.address.line')}
          value={line}
          onChange={(event) => patchLine(index, event.target.value)}
        />
      ))}
      <Button
        size="sm"
        variant="primary"
        icon={<Plus size={13} aria-hidden="true" />}
        onClick={() => set({ lines: [...address.lines, ''] })}
      >
        {nls.t('features.tree.address.addLine')}
      </Button>
      <FieldGrid columns={2}>
        <Field label={nls.t('features.tree.address.city')}>
          <Input
            placeholder={nls.t('features.tree.address.city')}
            value={address.city}
            onChange={(event) => set({ city: event.target.value })}
          />
        </Field>
        <Field label={nls.t('features.tree.address.state')}>
          <Input
            placeholder={nls.t('features.tree.address.state')}
            value={address.state}
            onChange={(event) => set({ state: event.target.value })}
          />
        </Field>
        <Field label={nls.t('features.tree.address.postalCode')}>
          <Input
            placeholder={nls.t('features.tree.address.postalCode')}
            value={address.postalCode}
            onChange={(event) => set({ postalCode: event.target.value })}
          />
        </Field>
        <Field label={nls.t('features.tree.address.country')}>
          <Input
            placeholder={nls.t('features.tree.address.country')}
            value={address.country}
            onChange={(event) => set({ country: event.target.value })}
          />
        </Field>
      </FieldGrid>
    </Subcard>
  );
}

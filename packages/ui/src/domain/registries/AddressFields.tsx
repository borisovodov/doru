import { Paperclip, Plus, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { nls } from '../../nls';
import { Button } from '../../atoms/button/Button';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Field } from '../../atoms/field/Field';
import { FieldGrid } from '../../atoms/field-grid/FieldGrid';
import { Input } from '../../atoms/form/Input';
import { ReorderButtons } from '../../atoms/reorder-buttons/ReorderButtons';
import { Subcard } from '../../patterns/subcard/Subcard';
import { useAutoFocusSelect } from '../../lib/useAutoFocusSelect';
import { moveItem } from '../reorder';
import type { AddressDraft } from './address';
import styles from './AddressFields.module.css';

/** The address sub-form shared by the repository and submitter editors. */
export function AddressFields({
  address,
  onChange,
  renderAttachments,
  autoFocus = false,
}: {
  address: AddressDraft;
  onChange: (draft: AddressDraft) => void;
  renderAttachments?: ((lineId: string) => ReactNode) | undefined;
  /** Focuses the first address line when a new address tab opens. */
  autoFocus?: boolean;
}) {
  const firstLineRef = useAutoFocusSelect<HTMLInputElement>(autoFocus);
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);
  const set = (patch: Partial<AddressDraft>) => onChange({ ...address, ...patch });
  const patchLine = (index: number, value: string) =>
    set({ lines: address.lines.map((line, i) => (i === index ? { ...line, value } : line)) });

  return (
    <Subcard>
      <div className={styles['fields']}>
        <h4 className={styles['title']}>{nls.t('features.tree.address.title')}</h4>
        {address.lines.map((line, index) => (
          <div key={line.id ?? `new-${index}`}>
            <div className={styles['lineRow']}>
              <Input
                ref={index === 0 ? firstLineRef : undefined}
                aria-label={nls.t('features.tree.address.line')}
                placeholder={nls.t('features.tree.address.line')}
                value={line.value}
                onChange={(event) => patchLine(index, event.target.value)}
              />
              <ReorderButtons
                upLabel={nls.t('features.tree.reorder.up')}
                downLabel={nls.t('features.tree.reorder.down')}
                canMoveUp={index > 0}
                canMoveDown={index < address.lines.length - 1}
                onMoveUp={() => set({ lines: moveItem(address.lines, index, index - 1) })}
                onMoveDown={() => set({ lines: moveItem(address.lines, index, index + 1) })}
              />
              {renderAttachments !== undefined && line.id !== undefined && (
                <IconButton
                  size="sm"
                  label={nls.t('features.tree.attachments.show')}
                  icon={<Paperclip size={13} aria-hidden="true" />}
                  onClick={() => setExpandedLineId(expandedLineId === line.id ? null : (line.id ?? null))}
                />
              )}
              <IconButton
                size="sm"
                label={nls.t('features.tree.address.removeLine')}
                icon={<X size={13} aria-hidden="true" />}
                onClick={() => set({ lines: address.lines.filter((_, lineIndex) => lineIndex !== index) })}
              />
            </div>
            {line.id !== undefined && expandedLineId === line.id && renderAttachments?.(line.id)}
          </div>
        ))}
        <Button
          size="sm"
          variant="primary"
          icon={<Plus size={13} aria-hidden="true" />}
          onClick={() => set({ lines: [...address.lines, { id: undefined, value: '' }] })}
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
      </div>
    </Subcard>
  );
}

import { useState } from 'react';
import { cx } from '../../lib/cx';
import { Button } from '../../atoms/button/Button';
import { Select } from '../../atoms/form/Select';
import styles from './AttachExisting.module.css';

export interface AttachExistingOption {
  id: string;
  label: string;
}

export interface AttachExistingProps {
  /** Empty option text and the accessible name of the record list. */
  label: string;
  /** Text of the confirmation button. */
  actionLabel: string;
  options: readonly AttachExistingOption[];
  onAttach: (id: string) => Promise<void>;
  className?: string | undefined;
}

/**
 * A record list and its attach action. The parent owns the candidates and the
 * write; the control only clears its selection after a successful attach.
 */
export function AttachExisting({ label, actionLabel, options, onAttach, className }: AttachExistingProps) {
  const [selected, setSelected] = useState('');
  const [pending, setPending] = useState(false);

  if (options.length === 0) {
    return null;
  }

  const attach = async () => {
    if (selected === '' || pending) {
      return;
    }
    setPending(true);
    try {
      await onAttach(selected);
      setSelected('');
    } catch {
      // The owner reports the failure and keeps the record for a retry.
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cx(styles['row'], className)}>
      <Select
        aria-label={label}
        value={selected}
        disabled={pending}
        onChange={(event) => setSelected(event.target.value)}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>
      <Button variant="secondary" loading={pending} disabled={selected === ''} onClick={() => void attach()}>
        {actionLabel}
      </Button>
    </div>
  );
}

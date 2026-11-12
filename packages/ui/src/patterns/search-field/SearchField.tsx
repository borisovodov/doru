import { Search } from 'lucide-react';
import { cx } from '../../lib/cx';
import { Input } from '../../atoms/form/Input';
import styles from './SearchField.module.css';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name; placeholders are not names. */
  label: string;
  placeholder?: string;
  className?: string;
}

/** A search input with the shared leading icon. */
export function SearchField({ value, onChange, label, placeholder, className }: SearchFieldProps) {
  return (
    <div className={cx(styles['field'], className)} role="search">
      <Search size={14} aria-hidden="true" />
      <Input
        controlSize="sm"
        value={value}
        aria-label={label}
        placeholder={placeholder ?? label}
        onChange={(event) => onChange(event.target.value)}
        className={styles['input']}
      />
    </div>
  );
}

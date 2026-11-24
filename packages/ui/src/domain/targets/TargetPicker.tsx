import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { foldCase, type TargetRef, type TargetType } from '@doru/core/model';
import { nls } from '../../nls';
import {
  createTaskTargetLabeler,
  targetOptionsForTypes,
  type TargetData,
  type TargetOption,
} from '../task/taskTargets';
import { useTargetDirectory } from './TargetDirectory';
import styles from './TargetPicker.module.css';

/**
 * A searchable multi-select of arbitrary tree records. The selected value is a
 * list of polymorphic target refs; the caller decides which target types are
 * legal. The option list is grouped by target type and never asks the user to
 * pick a type first.
 */
export function TargetPicker({
  allowedTypes,
  value,
  onChange,
  data: explicitData,
  placeholder,
  ariaLabel,
  disabled = false,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: {
  allowedTypes: readonly string[];
  value: readonly TargetRef[];
  onChange: (targets: TargetRef[]) => void;
  data?: TargetData | undefined;
  placeholder?: string | undefined;
  ariaLabel?: string | undefined;
  disabled?: boolean | undefined;
  id?: string | undefined;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: boolean | undefined;
}) {
  const directory = useTargetDirectory();
  const data = explicitData ?? directory;
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const options = useMemo(
    () => (data === undefined || !open ? [] : targetOptionsForTypes(allowedTypes, data)),
    [allowedTypes, data, open],
  );
  const selected = useMemo(() => new Set(value.map(targetKey)), [value]);
  const labeler = useMemo(() => (data === undefined ? undefined : createTaskTargetLabeler(data)), [data]);
  const matches = useMemo(() => {
    const needle = foldCase(query.trim());
    return options.filter((option) => {
      if (selected.has(`${option.type}:${option.id}`)) {
        return false;
      }
      if (needle === '') {
        return true;
      }
      return foldCase(option.label).includes(needle) || foldCase(typeLabel(option.type)).includes(needle);
    });
  }, [options, query, selected]);

  const groups = useMemo(() => {
    const byType = new Map<string, TargetOption[]>();
    for (const option of matches) {
      const entries = byType.get(option.type) ?? [];
      entries.push(option);
      byType.set(option.type, entries);
    }
    return allowedTypes
      .map((type) => ({ type, options: byType.get(type) ?? [] }))
      .filter((group) => group.options.length > 0);
  }, [allowedTypes, matches]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = (event: MouseEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const add = (option: TargetOption) => {
    onChange([...value, { targetType: option.type, targetId: option.id }]);
    setQuery('');
  };

  const remove = (target: TargetRef) => {
    onChange(value.filter((entry) => targetKey(entry) !== targetKey(target)));
  };

  const labelFor = (target: TargetRef): string =>
    labeler === undefined ? `${target.targetType}:${target.targetId}` : labeler(target.targetType, target.targetId);

  return (
    <div className={styles['picker']} ref={rootRef}>
      <div className={styles['field']}>
        {value.map((target) => (
          <span key={targetKey(target)} className={styles['chip']}>
            <span className={styles['chipType']}>{typeLabel(target.targetType)}</span>
            <span className={styles['chipLabel']}>{labelFor(target)}</span>
            <button
              type="button"
              className={styles['chipRemove']}
              aria-label={nls.t('features.targets.remove')}
              disabled={disabled}
              onClick={() => remove(target)}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          className={styles['input']}
          id={id}
          value={query}
          disabled={disabled}
          placeholder={value.length === 0 ? (placeholder ?? nls.t('features.search.field')) : ''}
          aria-label={ariaLabel ?? nls.t('features.search.field')}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          aria-controls={listId}
          aria-expanded={open}
          role="combobox"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
            } else if (event.key === 'Backspace' && query === '' && value.length > 0) {
              remove(value[value.length - 1] as TargetRef);
            }
          }}
        />
      </div>
      {open && !disabled && (
        <div className={styles['menu']} role="listbox" id={listId}>
          {groups.length === 0 ? (
            <p className={styles['empty']}>{nls.t('features.search.empty')}</p>
          ) : (
            groups.map((group) => (
              <div key={group.type} className={styles['group']} role="group" aria-label={typeLabel(group.type)}>
                <p className={styles['groupTitle']} aria-hidden="true">
                  {typeLabel(group.type)}
                </p>
                {group.options.slice(0, 50).map((option) => (
                  <button
                    key={`${option.type}:${option.id}`}
                    type="button"
                    role="option"
                    aria-selected="false"
                    className={styles['option']}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => add(option)}
                  >
                    <span className={styles['optionLabel']}>{option.label}</span>
                    <span className={styles['optionType']}>{typeLabel(option.type)}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function targetKey(target: TargetRef): string {
  return `${target.targetType}:${target.targetId}`;
}

function typeLabel(type: string): string {
  return nls.t(`features.tasks.target.${type as TargetType}`);
}

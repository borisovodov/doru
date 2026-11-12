import { useState, type FormEvent } from 'react';
import { Check, X } from 'lucide-react';
import type { PersonRecord } from '@doru/core';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Input } from '../../atoms/form/Input';
import { nls } from '../../nls';
import styles from './PersonCardEditor.module.css';

export interface PersonCardEditorProps {
  onSave: (person: PersonRecord) => void;
  onCancel: () => void;
  autoFocus?: boolean;
}

/** The compact name form that appears inside a draft person card. */
export function PersonCardEditor({ onSave, onCancel, autoFocus = false }: PersonCardEditorProps) {
  const [given, setGiven] = useState('');
  const [surname, setSurname] = useState('');

  const save = (event: FormEvent) => {
    event.preventDefault();
    const trimmedGiven = given.trim();
    const trimmedSurname = surname.trim();
    if (!trimmedGiven && !trimmedSurname) {
      return;
    }
    onSave({
      id: crypto.randomUUID(),
      names: [
        {
          id: crypto.randomUUID(),
          ...(trimmedGiven !== '' ? { given: trimmedGiven } : {}),
          ...(trimmedSurname !== '' ? { surname: trimmedSurname } : {}),
        },
      ],
      sex: 'U',
      facts: [],
    });
  };

  return (
    <form className={styles['form']} onSubmit={save} aria-label={nls.t('tree.canvas.addFirstPerson')}>
      <div className={styles['fields']}>
        <Input
          controlSize="sm"
          value={given}
          placeholder={nls.t('features.tree.field.given')}
          aria-label={nls.t('features.tree.field.given')}
          onChange={(event) => setGiven(event.target.value)}
          autoFocus={autoFocus}
        />
        <Input
          controlSize="sm"
          value={surname}
          placeholder={nls.t('features.tree.field.surname')}
          aria-label={nls.t('features.tree.field.surname')}
          onChange={(event) => setSurname(event.target.value)}
        />
      </div>
      <div className={styles['actions']}>
        <IconButton
          type="submit"
          size="sm"
          label={nls.t('features.tree.save')}
          icon={<Check size={14} aria-hidden="true" />}
          disabled={!given.trim() && !surname.trim()}
        />
        <IconButton
          type="button"
          size="sm"
          label={nls.t('tree.canvas.cancel')}
          icon={<X size={14} aria-hidden="true" />}
          onClick={onCancel}
        />
      </div>
    </form>
  );
}

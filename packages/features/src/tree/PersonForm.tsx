import { useState, type FormEvent } from 'react';
import type { PersonRecord, Sex } from '@doru/core';
import { nls } from '../nls';

export interface PersonFormProps {
  title: string;
  /** Prefill for editing an existing person; creates a new one when absent. */
  initial?: PersonRecord | undefined;
  onSubmit: (person: PersonRecord) => void;
  onCancel: () => void;
}

/** Splits a GEDCOM-style full name ("Petr /Ivanov/") into its parts. */
function splitFullName(full: string): { given: string; surname: string } {
  const words = full.replace(/\//g, '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return { given: '', surname: '' };
  }
  return { given: words[0] ?? '', surname: words.slice(1).join(' ') };
}

/**
 * Person creation/editing form: name, sex, birth/death years. Used by the
 * canvas quick actions to add a child, spouse or parent, and to rename a
 * person in place.
 */
export function PersonForm({ title, initial, onSubmit, onCancel }: PersonFormProps) {
  const initialParts = initial?.names[0]
    ? initial.names[0].full
      ? splitFullName(initial.names[0].full)
      : { given: initial.names[0].given ?? '', surname: initial.names[0].surname ?? '' }
    : { given: '', surname: '' };
  const [given, setGiven] = useState(initialParts.given);
  const [surname, setSurname] = useState(initialParts.surname);
  const [sex, setSex] = useState<Sex>(initial?.sex ?? 'U');
  const [birthYear, setBirthYear] = useState(
    initial?.birth?.year !== undefined ? String(initial.birth.year) : '',
  );
  const [deathYear, setDeathYear] = useState(
    initial?.death?.year !== undefined ? String(initial.death.year) : '',
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!given.trim() && !surname.trim()) {
      return;
    }
    const person: PersonRecord = {
      id: initial?.id ?? crypto.randomUUID(),
      names: [
        {
          ...(given.trim() !== '' ? { given: given.trim() } : {}),
          ...(surname.trim() !== '' ? { surname: surname.trim() } : {}),
        },
      ],
      sex,
      ...(birthYear.trim() !== '' && Number.isFinite(Number(birthYear))
        ? { birth: { year: Number(birthYear), quality: 'exact' as const } }
        : {}),
      ...(deathYear.trim() !== '' && Number.isFinite(Number(deathYear))
        ? { death: { year: Number(deathYear), quality: 'exact' as const } }
        : {}),
    };
    onSubmit(person);
  };

  return (
    <form className="person-form" onSubmit={handleSubmit}>
      <h3 className="person-form-title">{title}</h3>
      <label className="person-form-field">
        <span>{nls.t('features.tree.field.given')}</span>
        <input value={given} onChange={(event) => setGiven(event.target.value)} autoFocus />
      </label>
      <label className="person-form-field">
        <span>{nls.t('features.tree.field.surname')}</span>
        <input value={surname} onChange={(event) => setSurname(event.target.value)} />
      </label>
      <div className="person-form-field">
        <span>{nls.t('features.tree.field.sex')}</span>
        <div className="person-form-sex" role="group">
          {(['M', 'F', 'U'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={sex === value ? 'active' : undefined}
              onClick={() => setSex(value)}
            >
              {nls.t(`features.tree.sex.${value}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="person-form-row">
        <label className="person-form-field">
          <span>{nls.t('features.tree.field.birthYear')}</span>
          <input
            value={birthYear}
            inputMode="numeric"
            onChange={(event) => setBirthYear(event.target.value)}
          />
        </label>
        <label className="person-form-field">
          <span>{nls.t('features.tree.field.deathYear')}</span>
          <input
            value={deathYear}
            inputMode="numeric"
            onChange={(event) => setDeathYear(event.target.value)}
          />
        </label>
      </div>
      <div className="person-form-actions">
        <button type="button" onClick={onCancel}>
          {nls.t('tree.canvas.cancel')}
        </button>
        <button type="submit" className="primary" disabled={!given.trim() && !surname.trim()}>
          {nls.t('features.tree.save')}
        </button>
      </div>
    </form>
  );
}

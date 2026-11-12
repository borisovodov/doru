import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { PersonRecord } from '@doru/core';
import { nls } from '../nls';
import { displayName } from '@doru/ui';
import './AssociationsSection.css';

/**
 * The person's alias links (GEDCOM ALIA): other records marked as the
 * same person. The link is symmetric — it shows on both persons. Rows
 * only unlink; linking picks another person.
 */
export function AliasesSection({
  personId,
  aliases,
  persons,
  onAdd,
  onDelete,
}: {
  personId: string;
  aliases: Array<{ id: string; aliasId: string }>;
  persons: PersonRecord[];
  onAdd: (personId: string, aliasId: string) => Promise<void>;
  onDelete: (id: string, personId: string, aliasId: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState('');
  const others = persons.filter(
    (person) => person.id !== personId && !aliases.some((alias) => alias.aliasId === person.id),
  );

  const save = async () => {
    if (selected === '') {
      return;
    }
    await onAdd(personId, selected);
    setSelected('');
    setAdding(false);
  };

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.aliases.title')}</h3>
      {aliases.length === 0 && !adding && <p className="notes-empty">{nls.t('features.tree.aliases.empty')}</p>}
      <ul className="association-list">
        {aliases.map((alias) => {
          const other = persons.find((person) => person.id === alias.aliasId);
          return (
            <li key={alias.id}>
              <div className="association-row">
                <span className="association-name">{other ? displayName(other) : alias.aliasId}</span>
                <button
                  className="icon-button"
                  title={nls.t('features.tree.aliases.remove')}
                  onClick={() => void onDelete(alias.id, personId, alias.aliasId)}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {adding ? (
        <div className="association-fields">
          <label>
            {nls.t('features.tree.aliases.person')}
            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
              <option value="">{nls.t('features.tree.aliases.none')}</option>
              {others.map((person) => (
                <option key={person.id} value={person.id}>
                  {displayName(person)}
                </option>
              ))}
            </select>
          </label>
          <div className="association-actions">
            <button className="add-button" onClick={() => void save()}>
              {nls.t('features.tree.save')}
            </button>
            <button className="plain-button" onClick={() => setAdding(false)}>
              {nls.t('features.tree.fact.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button className="add-button" onClick={() => setAdding(true)}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.aliases.add')}
        </button>
      )}
    </div>
  );
}

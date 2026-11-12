import { useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import type { AssociationRecord, PersonRecord } from '@doru/core';
import { nls } from '../nls';
import { associationDraftToRecord, associationToDraft, emptyAssociationDraft, type AssociationDraft } from '@doru/ui';
import { DateEditor } from '@doru/ui';
import { displayName } from '@doru/ui';
import './AssociationsSection.css';

/**
 * The person's non-family relations (GEDCOM ASSO): each row links to
 * another person and carries role, relationship, phrase and the period.
 * Rows edit inline — pick the other person, save the row.
 */
export function AssociationsSection({
  personId,
  associations,
  persons,
  onAdd,
  onUpdate,
  onDelete,
}: {
  personId: string;
  associations: AssociationRecord[];
  persons: PersonRecord[];
  onAdd: (association: AssociationRecord) => Promise<void>;
  onUpdate: (before: AssociationRecord, after: AssociationRecord) => Promise<void>;
  onDelete: (association: AssociationRecord) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const others = persons.filter((person) => person.id !== personId);

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.associations.title')}</h3>
      {associations.length === 0 && !adding && (
        <p className="notes-empty">{nls.t('features.tree.associations.empty')}</p>
      )}
      <ul className="association-list">
        {associations.map((association) => (
          <li key={association.id}>
            <AssociationRow association={association} others={others} onUpdate={onUpdate} onDelete={onDelete} />
          </li>
        ))}
      </ul>
      {adding ? (
        <AddAssociationForm
          personId={personId}
          others={others}
          onAdd={onAdd}
          onDone={() => setAdding(false)}
        />
      ) : (
        <button className="add-button" onClick={() => setAdding(true)}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.associations.add')}
        </button>
      )}
    </div>
  );
}

function AssociationRow({
  association,
  others,
  onUpdate,
  onDelete,
}: {
  association: AssociationRecord;
  others: PersonRecord[];
  onUpdate: (before: AssociationRecord, after: AssociationRecord) => Promise<void>;
  onDelete: (association: AssociationRecord) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AssociationDraft>(() => associationToDraft(association));
  const other = others.find((person) => person.id === association.otherPersonId);

  if (!editing) {
    return (
      <div className="association-row">
        <span className="association-name">{other ? displayName(other) : association.otherPersonId}</span>
        {association.relationship ? <span className="association-relationship">{association.relationship}</span> : null}
        <button className="icon-button" title={nls.t('features.tree.associations.edit')} onClick={() => setEditing(true)}>
          <Pencil size={13} aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          title={nls.t('features.tree.associations.remove')}
          onClick={() => void onDelete(association)}
        >
          <X size={13} aria-hidden="true" />
        </button>
      </div>
    );
  }

  const save = async () => {
    if (draft.otherPersonId === '') {
      return;
    }
    await onUpdate(association, associationDraftToRecord(draft));
    setEditing(false);
  };

  return (
    <div className="association-editor">
      <AssociationFields draft={draft} others={others} onChange={setDraft} />
      <div className="association-actions">
        <button className="add-button" onClick={() => void save()}>
          {nls.t('features.tree.save')}
        </button>
        <button className="plain-button" onClick={() => setEditing(false)}>
          {nls.t('features.tree.fact.cancel')}
        </button>
      </div>
    </div>
  );
}

function AddAssociationForm({
  personId,
  others,
  onAdd,
  onDone,
}: {
  personId: string;
  others: PersonRecord[];
  onAdd: (association: AssociationRecord) => Promise<void>;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<AssociationDraft>(() => emptyAssociationDraft(personId));

  const save = async () => {
    if (draft.otherPersonId === '') {
      return;
    }
    await onAdd(associationDraftToRecord(draft));
    onDone();
  };

  return (
    <div className="association-editor">
      <AssociationFields draft={draft} others={others} onChange={setDraft} />
      <div className="association-actions">
        <button className="add-button" onClick={() => void save()}>
          {nls.t('features.tree.save')}
        </button>
        <button className="plain-button" onClick={onDone}>
          {nls.t('features.tree.fact.cancel')}
        </button>
      </div>
    </div>
  );
}

function AssociationFields({
  draft,
  others,
  onChange,
}: {
  draft: AssociationDraft;
  others: PersonRecord[];
  onChange: (draft: AssociationDraft) => void;
}) {
  const set = (patch: Partial<AssociationDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="association-fields">
      <label>
        {nls.t('features.tree.associations.person')}
        <select value={draft.otherPersonId} onChange={(event) => set({ otherPersonId: event.target.value })}>
          <option value="">{nls.t('features.tree.associations.person.none')}</option>
          {others.map((person) => (
            <option key={person.id} value={person.id}>
              {displayName(person)}
            </option>
          ))}
        </select>
      </label>
      <div className="association-grid">
        <label>
          {nls.t('features.tree.associations.relationship')}
          <input
            value={draft.relationship}
            onChange={(event) => set({ relationship: event.target.value })}
          />
        </label>
        <label>
          {nls.t('features.tree.associations.role')}
          <input value={draft.role} onChange={(event) => set({ role: event.target.value })} />
        </label>
        <label>
          {nls.t('features.tree.associations.specificType')}
          <input value={draft.specificType} onChange={(event) => set({ specificType: event.target.value })} />
        </label>
        <label>
          {nls.t('features.tree.associations.confidence')}
          <input value={draft.confidence} onChange={(event) => set({ confidence: event.target.value })} />
        </label>
      </div>
      <label>
        {nls.t('features.tree.associations.phrase')}
        <input value={draft.phrase} onChange={(event) => set({ phrase: event.target.value })} />
      </label>
      <label className="association-primary">
        <input type="checkbox" checked={draft.primary} onChange={(event) => set({ primary: event.target.checked })} />
        {nls.t('features.tree.associations.primary')}
      </label>
      <DateEditor
        label={nls.t('features.tree.associations.periodStart')}
        value={draft.periodStart}
        onChange={(periodStart) => set({ periodStart })}
        hidePlace
      />
      <DateEditor
        label={nls.t('features.tree.associations.periodEnd')}
        value={draft.periodEnd}
        onChange={(periodEnd) => set({ periodEnd })}
        hidePlace
      />
    </div>
  );
}

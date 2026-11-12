import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import type { ContactRecord, IdentifierRecord, RestrictionRecord } from '@doru/core';
import { nls } from '../../nls';
import './AttachmentsSection.css';

const ID_NAMESPACES = ['uid', 'exid', 'refn', 'rin', 'sosa', 'daboville'];

const CONTACT_KINDS = ['email', 'phone', 'fax', 'url', 'www'] as const;

const RESTRICTION_LEVELS = ['confidential', 'locked', 'privacy'] as const;

/** Localized labels for the known contact kinds (unknown kinds show verbatim). */
function contactKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    email: nls.t('features.tree.contacts.kind.email'),
    phone: nls.t('features.tree.contacts.kind.phone'),
    fax: nls.t('features.tree.contacts.kind.fax'),
    url: nls.t('features.tree.contacts.kind.url'),
    www: nls.t('features.tree.contacts.kind.www'),
  };
  return labels[kind] ?? kind;
}

/** Localized labels for the known restriction levels (unknown levels show verbatim). */
function restrictionLevelLabel(level: string): string {
  const labels: Record<string, string> = {
    confidential: nls.t('features.tree.restrictions.level.confidential'),
    locked: nls.t('features.tree.restrictions.level.locked'),
    privacy: nls.t('features.tree.restrictions.level.privacy'),
  };
  return labels[level] ?? level;
}

/** External identifiers of the person (REFN, SOSA, …), with inline editing. */
export function IdentifiersSection({
  targetType,
  targetId,
  identifiers,
  onAdd,
  onUpdate,
  onDelete,
}: {
  targetType: string;
  targetId: string;
  identifiers: IdentifierRecord[];
  onAdd: (identifier: IdentifierRecord) => Promise<void>;
  onUpdate: (before: IdentifierRecord, after: IdentifierRecord) => Promise<void>;
  onDelete: (identifier: IdentifierRecord) => Promise<void>;
}) {
  const [namespace, setNamespace] = useState('');
  const [value, setValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNamespace, setEditNamespace] = useState('');
  const [editValue, setEditValue] = useState('');

  const add = async () => {
    const trimmedNamespace = namespace.trim();
    const trimmedValue = value.trim();
    if (trimmedNamespace === '' || trimmedValue === '') {
      return;
    }
    await onAdd({
      id: crypto.randomUUID(),
      targetType,
      targetId,
      namespace: trimmedNamespace,
      value: trimmedValue,
    });
    setNamespace('');
    setValue('');
  };

  const startEdit = (identifier: IdentifierRecord) => {
    setEditingId(identifier.id);
    setEditNamespace(identifier.namespace);
    setEditValue(identifier.value);
  };

  const saveEdit = async (identifier: IdentifierRecord) => {
    const trimmedNamespace = editNamespace.trim();
    const trimmedValue = editValue.trim();
    if (
      trimmedNamespace !== '' &&
      trimmedValue !== '' &&
      (trimmedNamespace !== identifier.namespace || trimmedValue !== identifier.value)
    ) {
      await onUpdate(identifier, { ...identifier, namespace: trimmedNamespace, value: trimmedValue });
    }
    setEditingId(null);
  };

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.identifiers.title')}</h3>
      {identifiers.length === 0 && <p className="notes-empty">{nls.t('features.tree.identifiers.empty')}</p>}
      <ul className="attachment-list">
        {identifiers.map((identifier) => (
          <li key={identifier.id}>
            {editingId === identifier.id ? (
              <div className="attachment-edit">
                <input
                  className="attachment-edit-namespace"
                  value={editNamespace}
                  placeholder={nls.t('features.tree.identifiers.namespace')}
                  onChange={(event) => setEditNamespace(event.target.value)}
                  autoFocus
                />
                <input
                  value={editValue}
                  placeholder={nls.t('features.tree.identifiers.value')}
                  onChange={(event) => setEditValue(event.target.value)}
                />
                <button className="add-button small" onClick={() => void saveEdit(identifier)}>
                  {nls.t('features.tree.save')}
                </button>
                <button className="plain-button small" onClick={() => setEditingId(null)}>
                  {nls.t('features.tree.fact.cancel')}
                </button>
              </div>
            ) : (
              <>
                <span className="attachment-kind">{identifier.namespace}</span>
                <span className="attachment-value">{identifier.value}</span>
                <button
                  className="icon-button"
                  title={nls.t('features.tree.identifiers.edit')}
                  onClick={() => startEdit(identifier)}
                >
                  <Pencil size={13} aria-hidden="true" />
                </button>
                <button
                  className="icon-button"
                  title={nls.t('features.tree.identifiers.remove')}
                  onClick={() => void onDelete(identifier)}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="attachment-add">
        <input
          list="doru-id-namespaces"
          placeholder={nls.t('features.tree.identifiers.namespace')}
          value={namespace}
          onChange={(event) => setNamespace(event.target.value)}
        />
        <datalist id="doru-id-namespaces">
          {ID_NAMESPACES.map((entry) => (
            <option key={entry} value={entry} />
          ))}
        </datalist>
        <input
          placeholder={nls.t('features.tree.identifiers.value')}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button className="add-button" onClick={() => void add()}>
          {nls.t('features.tree.identifiers.add')}
        </button>
      </div>
    </div>
  );
}

/** Contact details of the person (email, phone, …), with inline editing. */
export function ContactsSection({
  targetType,
  targetId,
  contacts,
  onAdd,
  onUpdate,
  onDelete,
}: {
  targetType: string;
  targetId: string;
  contacts: ContactRecord[];
  onAdd: (contact: ContactRecord) => Promise<void>;
  onUpdate: (before: ContactRecord, after: ContactRecord) => Promise<void>;
  onDelete: (contact: ContactRecord) => Promise<void>;
}) {
  const [kind, setKind] = useState('email');
  const [value, setValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKind, setEditKind] = useState('email');
  const [editValue, setEditValue] = useState('');

  const add = async () => {
    const trimmedValue = value.trim();
    if (trimmedValue === '') {
      return;
    }
    await onAdd({ id: crypto.randomUUID(), targetType, targetId, kind, value: trimmedValue });
    setValue('');
  };

  const startEdit = (contact: ContactRecord) => {
    setEditingId(contact.id);
    setEditKind(contact.kind);
    setEditValue(contact.value);
  };

  const saveEdit = async (contact: ContactRecord) => {
    const trimmedValue = editValue.trim();
    if (trimmedValue !== '' && (editKind !== contact.kind || trimmedValue !== contact.value)) {
      await onUpdate(contact, { ...contact, kind: editKind, value: trimmedValue });
    }
    setEditingId(null);
  };

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.contacts.title')}</h3>
      {contacts.length === 0 && <p className="notes-empty">{nls.t('features.tree.contacts.empty')}</p>}
      <ul className="attachment-list">
        {contacts.map((contact) => (
          <li key={contact.id}>
            {editingId === contact.id ? (
              <div className="attachment-edit">
                <select value={editKind} onChange={(event) => setEditKind(event.target.value)}>
                  {CONTACT_KINDS.map((entry) => (
                    <option key={entry} value={entry}>
                      {nls.t(`features.tree.contacts.kind.${entry}`)}
                    </option>
                  ))}
                </select>
                <input
                  value={editValue}
                  placeholder={nls.t('features.tree.contacts.value')}
                  onChange={(event) => setEditValue(event.target.value)}
                  autoFocus
                />
                <button className="add-button small" onClick={() => void saveEdit(contact)}>
                  {nls.t('features.tree.save')}
                </button>
                <button className="plain-button small" onClick={() => setEditingId(null)}>
                  {nls.t('features.tree.fact.cancel')}
                </button>
              </div>
            ) : (
              <>
                <span className="attachment-kind">{contactKindLabel(contact.kind)}</span>
                <span className="attachment-value">{contact.value}</span>
                <button
                  className="icon-button"
                  title={nls.t('features.tree.contacts.edit')}
                  onClick={() => startEdit(contact)}
                >
                  <Pencil size={13} aria-hidden="true" />
                </button>
                <button
                  className="icon-button"
                  title={nls.t('features.tree.contacts.remove')}
                  onClick={() => void onDelete(contact)}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="attachment-add">
        <select value={kind} onChange={(event) => setKind(event.target.value)}>
          {CONTACT_KINDS.map((entry) => (
            <option key={entry} value={entry}>
              {nls.t(`features.tree.contacts.kind.${entry}`)}
            </option>
          ))}
        </select>
        <input
          placeholder={nls.t('features.tree.contacts.value')}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button className="add-button" onClick={() => void add()}>
          {nls.t('features.tree.contacts.add')}
        </button>
      </div>
    </div>
  );
}

/** Privacy restrictions of the person, with inline editing. */
export function RestrictionsSection({
  targetType,
  targetId,
  restrictions,
  onAdd,
  onUpdate,
  onDelete,
}: {
  targetType: string;
  targetId: string;
  restrictions: RestrictionRecord[];
  onAdd: (restriction: RestrictionRecord) => Promise<void>;
  onUpdate: (before: RestrictionRecord, after: RestrictionRecord) => Promise<void>;
  onDelete: (restriction: RestrictionRecord) => Promise<void>;
}) {
  const [level, setLevel] = useState('privacy');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLevel, setEditLevel] = useState('privacy');

  const add = async () => {
    await onAdd({ id: crypto.randomUUID(), targetType, targetId, level });
  };

  const startEdit = (restriction: RestrictionRecord) => {
    setEditingId(restriction.id);
    setEditLevel(restriction.level);
  };

  const saveEdit = async (restriction: RestrictionRecord) => {
    if (editLevel !== restriction.level) {
      await onUpdate(restriction, { ...restriction, level: editLevel });
    }
    setEditingId(null);
  };

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.restrictions.title')}</h3>
      {restrictions.length === 0 && <p className="notes-empty">{nls.t('features.tree.restrictions.empty')}</p>}
      <ul className="attachment-list">
        {restrictions.map((restriction) => (
          <li key={restriction.id}>
            {editingId === restriction.id ? (
              <div className="attachment-edit">
                <select value={editLevel} onChange={(event) => setEditLevel(event.target.value)}>
                  {RESTRICTION_LEVELS.map((entry) => (
                    <option key={entry} value={entry}>
                      {nls.t(`features.tree.restrictions.level.${entry}`)}
                    </option>
                  ))}
                </select>
                <button className="add-button small" onClick={() => void saveEdit(restriction)}>
                  {nls.t('features.tree.save')}
                </button>
                <button className="plain-button small" onClick={() => setEditingId(null)}>
                  {nls.t('features.tree.fact.cancel')}
                </button>
              </div>
            ) : (
              <>
                <span className="attachment-value">{restrictionLevelLabel(restriction.level)}</span>
                <button
                  className="icon-button"
                  title={nls.t('features.tree.restrictions.edit')}
                  onClick={() => startEdit(restriction)}
                >
                  <Pencil size={13} aria-hidden="true" />
                </button>
                <button
                  className="icon-button"
                  title={nls.t('features.tree.restrictions.remove')}
                  onClick={() => void onDelete(restriction)}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="attachment-add">
        <select value={level} onChange={(event) => setLevel(event.target.value)}>
          {RESTRICTION_LEVELS.map((entry) => (
            <option key={entry} value={entry}>
              {nls.t(`features.tree.restrictions.level.${entry}`)}
            </option>
          ))}
        </select>
        <button className="add-button" onClick={() => void add()}>
          {nls.t('features.tree.restrictions.add')}
        </button>
      </div>
    </div>
  );
}

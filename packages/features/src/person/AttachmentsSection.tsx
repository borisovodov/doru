import { useState } from 'react';
import { X } from 'lucide-react';
import type { ContactRecord, IdentifierRecord, RestrictionRecord } from '@doru/core';
import { nls } from '../nls';
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

/** External identifiers of the person (REFN, SOSA, …). */
export function IdentifiersSection({
  targetType,
  targetId,
  identifiers,
  onAdd,
  onDelete,
}: {
  targetType: string;
  targetId: string;
  identifiers: IdentifierRecord[];
  onAdd: (identifier: IdentifierRecord) => Promise<void>;
  onDelete: (identifier: IdentifierRecord) => Promise<void>;
}) {
  const [namespace, setNamespace] = useState('');
  const [value, setValue] = useState('');

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

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.identifiers.title')}</h3>
      {identifiers.length === 0 && <p className="notes-empty">{nls.t('features.tree.identifiers.empty')}</p>}
      <ul className="attachment-list">
        {identifiers.map((identifier) => (
          <li key={identifier.id}>
            <span className="attachment-kind">{identifier.namespace}</span>
            <span className="attachment-value">{identifier.value}</span>
            <button
              className="icon-button"
              title={nls.t('features.tree.identifiers.remove')}
              onClick={() => void onDelete(identifier)}
            >
              <X size={13} aria-hidden="true" />
            </button>
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

/** Contact details of the person (email, phone, …). */
export function ContactsSection({
  targetType,
  targetId,
  contacts,
  onAdd,
  onDelete,
}: {
  targetType: string;
  targetId: string;
  contacts: ContactRecord[];
  onAdd: (contact: ContactRecord) => Promise<void>;
  onDelete: (contact: ContactRecord) => Promise<void>;
}) {
  const [kind, setKind] = useState('email');
  const [value, setValue] = useState('');

  const add = async () => {
    const trimmedValue = value.trim();
    if (trimmedValue === '') {
      return;
    }
    await onAdd({
      id: crypto.randomUUID(),
      targetType,
      targetId,
      kind,
      value: trimmedValue,
    });
    setValue('');
  };

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.contacts.title')}</h3>
      {contacts.length === 0 && <p className="notes-empty">{nls.t('features.tree.contacts.empty')}</p>}
      <ul className="attachment-list">
        {contacts.map((contact) => (
          <li key={contact.id}>
            <span className="attachment-kind">{contactKindLabel(contact.kind)}</span>
            <span className="attachment-value">{contact.value}</span>
            <button
              className="icon-button"
              title={nls.t('features.tree.contacts.remove')}
              onClick={() => void onDelete(contact)}
            >
              <X size={13} aria-hidden="true" />
            </button>
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

/** Privacy restrictions of the person. */
export function RestrictionsSection({
  targetType,
  targetId,
  restrictions,
  onAdd,
  onDelete,
}: {
  targetType: string;
  targetId: string;
  restrictions: RestrictionRecord[];
  onAdd: (restriction: RestrictionRecord) => Promise<void>;
  onDelete: (restriction: RestrictionRecord) => Promise<void>;
}) {
  const [level, setLevel] = useState('privacy');

  const add = async () => {
    await onAdd({ id: crypto.randomUUID(), targetType, targetId, level });
  };

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.restrictions.title')}</h3>
      {restrictions.length === 0 && <p className="notes-empty">{nls.t('features.tree.restrictions.empty')}</p>}
      <ul className="attachment-list">
        {restrictions.map((restriction) => (
          <li key={restriction.id}>
            <span className="attachment-value">{restrictionLevelLabel(restriction.level)}</span>
            <button
              className="icon-button"
              title={nls.t('features.tree.restrictions.remove')}
              onClick={() => void onDelete(restriction)}
            >
              <X size={13} aria-hidden="true" />
            </button>
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

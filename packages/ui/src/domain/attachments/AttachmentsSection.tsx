import { Button } from '../../atoms/button/Button';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Input } from '../../atoms/form/Input';
import { Select } from '../../atoms/form/Select';
import { SectionCard } from '../../patterns/section-card/SectionCard';
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
    <SectionCard title={nls.t('features.tree.identifiers.title')}>
      {identifiers.length === 0 && <EmptyText>{nls.t('features.tree.identifiers.empty')}</EmptyText>}
      <ul className="attachment-list">
        {identifiers.map((identifier) => (
          <li key={identifier.id}>
            {editingId === identifier.id ? (
              <div className="attachment-edit">
                <Input
                  className="attachment-edit-namespace"
                  value={editNamespace}
                  placeholder={nls.t('features.tree.identifiers.namespace')}
                  onChange={(event) => setEditNamespace(event.target.value)}
                  autoFocus
                />
                <Input
                  value={editValue}
                  placeholder={nls.t('features.tree.identifiers.value')}
                  onChange={(event) => setEditValue(event.target.value)}
                />
                <Button variant="primary" size="sm" onClick={() => void saveEdit(identifier)}>
                  {nls.t('features.tree.save')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                  {nls.t('features.tree.fact.cancel')}
                </Button>
              </div>
            ) : (
              <>
                <span className="attachment-kind">{identifier.namespace}</span>
                <span className="attachment-value">{identifier.value}</span>
                <IconButton
                  size="sm"
                  label={nls.t('features.tree.identifiers.edit')}
                  icon={<Pencil size={13} aria-hidden="true" />}
                  onClick={() => startEdit(identifier)}
                />
                <IconButton
                  size="sm"
                  label={nls.t('features.tree.identifiers.remove')}
                  icon={<X size={13} aria-hidden="true" />}
                  onClick={() => void onDelete(identifier)}
                />
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="attachment-add">
        <Input
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
        <Input
          placeholder={nls.t('features.tree.identifiers.value')}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button variant="primary" onClick={() => void add()}>
          {nls.t('features.tree.identifiers.add')}
        </Button>
      </div>
    </SectionCard>
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
    <SectionCard title={nls.t('features.tree.contacts.title')}>
      {contacts.length === 0 && <EmptyText>{nls.t('features.tree.contacts.empty')}</EmptyText>}
      <ul className="attachment-list">
        {contacts.map((contact) => (
          <li key={contact.id}>
            {editingId === contact.id ? (
              <div className="attachment-edit">
                <Select value={editKind} onChange={(event) => setEditKind(event.target.value)}>
                  {CONTACT_KINDS.map((entry) => (
                    <option key={entry} value={entry}>
                      {nls.t(`features.tree.contacts.kind.${entry}`)}
                    </option>
                  ))}
                </Select>
                <Input
                  value={editValue}
                  placeholder={nls.t('features.tree.contacts.value')}
                  onChange={(event) => setEditValue(event.target.value)}
                  autoFocus
                />
                <Button variant="primary" size="sm" onClick={() => void saveEdit(contact)}>
                  {nls.t('features.tree.save')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                  {nls.t('features.tree.fact.cancel')}
                </Button>
              </div>
            ) : (
              <>
                <span className="attachment-kind">{contactKindLabel(contact.kind)}</span>
                <span className="attachment-value">{contact.value}</span>
                <IconButton
                  size="sm"
                  label={nls.t('features.tree.contacts.edit')}
                  icon={<Pencil size={13} aria-hidden="true" />}
                  onClick={() => startEdit(contact)}
                />
                <IconButton
                  size="sm"
                  label={nls.t('features.tree.contacts.remove')}
                  icon={<X size={13} aria-hidden="true" />}
                  onClick={() => void onDelete(contact)}
                />
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="attachment-add">
        <Select value={kind} onChange={(event) => setKind(event.target.value)}>
          {CONTACT_KINDS.map((entry) => (
            <option key={entry} value={entry}>
              {nls.t(`features.tree.contacts.kind.${entry}`)}
            </option>
          ))}
        </Select>
        <Input
          placeholder={nls.t('features.tree.contacts.value')}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button variant="primary" onClick={() => void add()}>
          {nls.t('features.tree.contacts.add')}
        </Button>
      </div>
    </SectionCard>
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
    <SectionCard title={nls.t('features.tree.restrictions.title')}>
      {restrictions.length === 0 && <EmptyText>{nls.t('features.tree.restrictions.empty')}</EmptyText>}
      <ul className="attachment-list">
        {restrictions.map((restriction) => (
          <li key={restriction.id}>
            {editingId === restriction.id ? (
              <div className="attachment-edit">
                <Select value={editLevel} onChange={(event) => setEditLevel(event.target.value)}>
                  {RESTRICTION_LEVELS.map((entry) => (
                    <option key={entry} value={entry}>
                      {nls.t(`features.tree.restrictions.level.${entry}`)}
                    </option>
                  ))}
                </Select>
                <Button variant="primary" size="sm" onClick={() => void saveEdit(restriction)}>
                  {nls.t('features.tree.save')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                  {nls.t('features.tree.fact.cancel')}
                </Button>
              </div>
            ) : (
              <>
                <span className="attachment-value">{restrictionLevelLabel(restriction.level)}</span>
                <IconButton
                  size="sm"
                  label={nls.t('features.tree.restrictions.edit')}
                  icon={<Pencil size={13} aria-hidden="true" />}
                  onClick={() => startEdit(restriction)}
                />
                <IconButton
                  size="sm"
                  label={nls.t('features.tree.restrictions.remove')}
                  icon={<X size={13} aria-hidden="true" />}
                  onClick={() => void onDelete(restriction)}
                />
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="attachment-add">
        <Select value={level} onChange={(event) => setLevel(event.target.value)}>
          {RESTRICTION_LEVELS.map((entry) => (
            <option key={entry} value={entry}>
              {nls.t(`features.tree.restrictions.level.${entry}`)}
            </option>
          ))}
        </Select>
        <Button variant="primary" onClick={() => void add()}>
          {nls.t('features.tree.restrictions.add')}
        </Button>
      </div>
    </SectionCard>
  );
}

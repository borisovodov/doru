import { Button } from '../../atoms/button/Button';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Input } from '../../atoms/form/Input';
import { Select } from '../../atoms/form/Select';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { ContactRecord } from '@doru/core';
import { nls } from '../../nls';
import './AttachmentsSection.css';

const CONTACT_KINDS = ['email', 'phone', 'fax', 'www', 'skype', 'jabber'] as const;

/** Localized labels for the known contact kinds (unknown kinds show verbatim). */
function contactKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    email: nls.t('features.tree.contacts.kind.email'),
    phone: nls.t('features.tree.contacts.kind.phone'),
    fax: nls.t('features.tree.contacts.kind.fax'),
    url: nls.t('features.tree.contacts.kind.url'),
    www: nls.t('features.tree.contacts.kind.www'),
    skype: nls.t('features.tree.contacts.kind.skype'),
    jabber: nls.t('features.tree.contacts.kind.jabber'),
  };
  return labels[kind] ?? kind;
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
    setEditKind(contact.kind === 'url' ? 'www' : contact.kind);
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
                <Select
                  value={editKind}
                  aria-label={nls.t('features.tree.contacts.editKind')}
                  onChange={(event) => setEditKind(event.target.value)}
                >
                  {CONTACT_KINDS.map((entry) => (
                    <option key={entry} value={entry}>
                      {nls.t(`features.tree.contacts.kind.${entry}`)}
                    </option>
                  ))}
                  {!(CONTACT_KINDS as readonly string[]).includes(contact.kind) && contact.kind !== 'url' && (
                    <option value={contact.kind}>{contactKindLabel(contact.kind)}</option>
                  )}
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
                  icon={<Trash2 size={13} aria-hidden="true" />}
                  onClick={() => void onDelete(contact)}
                />
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="attachment-add">
        <Select
          value={kind}
          aria-label={nls.t('features.tree.contacts.kindField')}
          onChange={(event) => setKind(event.target.value)}
        >
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
        <Button variant="secondary" onClick={() => void add()}>
          {nls.t('features.tree.contacts.add')}
        </Button>
      </div>
    </SectionCard>
  );
}

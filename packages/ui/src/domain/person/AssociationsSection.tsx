import { useState, type ReactNode } from 'react';
import { Paperclip, Pencil, Plus, X } from 'lucide-react';
import type { AssociationRecord, PersonRecord } from '@doru/core';
import { nls } from '../../nls';
import { Button } from '../../atoms/button/Button';
import { Checkbox } from '../../atoms/form/Checkbox';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { Field } from '../../atoms/field/Field';
import { FieldGrid } from '../../atoms/field-grid/FieldGrid';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Input } from '../../atoms/form/Input';
import { Select } from '../../atoms/form/Select';
import { ActionBar } from '../../patterns/action-bar/ActionBar';
import { AttachmentRow, RowList } from '../../patterns/row-list/RowList';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import { Subcard } from '../../patterns/subcard/Subcard';
import { DateEditor } from '../date/DateEditor';
import { displayName } from '../format/format';
import {
  associationDraftToRecord,
  associationToDraft,
  emptyAssociationDraft,
  type AssociationDraft,
} from './associationDraft';
import styles from './AssociationsSection.module.css';

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
  renderAttachments,
}: {
  personId: string;
  associations: AssociationRecord[];
  persons: PersonRecord[];
  onAdd: (association: AssociationRecord) => Promise<void>;
  onUpdate: (before: AssociationRecord, after: AssociationRecord) => Promise<void>;
  onDelete: (association: AssociationRecord) => Promise<void>;
  renderAttachments?: ((association: AssociationRecord) => ReactNode) | undefined;
}) {
  const [adding, setAdding] = useState(false);
  const others = persons.filter((person) => person.id !== personId);

  return (
    <SectionCard title={nls.t('features.tree.associations.title')}>
      {associations.length === 0 && !adding ? <EmptyText>{nls.t('features.tree.associations.empty')}</EmptyText> : null}
      {associations.length > 0 ? (
        <RowList>
          {associations.map((association) => (
            <li key={association.id}>
              <AssociationRow
                association={association}
                others={others}
                onUpdate={onUpdate}
                onDelete={onDelete}
                renderAttachments={renderAttachments}
              />
            </li>
          ))}
        </RowList>
      ) : null}
      {adding ? (
        <AddAssociationForm personId={personId} others={others} onAdd={onAdd} onDone={() => setAdding(false)} />
      ) : (
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={13} aria-hidden="true" />}
          onClick={() => setAdding(true)}
        >
          {nls.t('features.tree.associations.add')}
        </Button>
      )}
    </SectionCard>
  );
}

function AssociationRow({
  association,
  others,
  onUpdate,
  onDelete,
  renderAttachments,
}: {
  association: AssociationRecord;
  others: PersonRecord[];
  onUpdate: (before: AssociationRecord, after: AssociationRecord) => Promise<void>;
  onDelete: (association: AssociationRecord) => Promise<void>;
  renderAttachments?: ((association: AssociationRecord) => ReactNode) | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [draft, setDraft] = useState<AssociationDraft>(() => associationToDraft(association));
  const other = others.find((person) => person.id === association.otherPersonId);

  if (!editing) {
    return (
      <>
        <AttachmentRow
          value={
            <>
              <strong>{other ? displayName(other) : association.otherPersonId}</strong>
              {association.relationship ? ` — ${association.relationship}` : ''}
            </>
          }
          actions={
            <>
              {renderAttachments !== undefined && (
                <IconButton
                  size="sm"
                  label={nls.t('features.tree.attachments.show')}
                  icon={<Paperclip size={13} aria-hidden="true" />}
                  onClick={() => setShowAttachments((current) => !current)}
                />
              )}
              <IconButton
                size="sm"
                label={nls.t('features.tree.associations.edit')}
                icon={<Pencil size={13} aria-hidden="true" />}
                onClick={() => setEditing(true)}
              />
              <IconButton
                size="sm"
                label={nls.t('features.tree.associations.remove')}
                icon={<X size={13} aria-hidden="true" />}
                onClick={() => void onDelete(association)}
              />
            </>
          }
        />
        {showAttachments && renderAttachments?.(association)}
      </>
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
    <Subcard>
      <AssociationFields draft={draft} others={others} onChange={setDraft} />
      <ActionBar>
        <Button variant="primary" onClick={() => void save()}>
          {nls.t('features.tree.save')}
        </Button>
        <Button variant="secondary" onClick={() => setEditing(false)}>
          {nls.t('features.tree.fact.cancel')}
        </Button>
      </ActionBar>
    </Subcard>
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
    <Subcard>
      <AssociationFields draft={draft} others={others} onChange={setDraft} />
      <ActionBar>
        <Button variant="primary" onClick={() => void save()}>
          {nls.t('features.tree.save')}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          {nls.t('features.tree.fact.cancel')}
        </Button>
      </ActionBar>
    </Subcard>
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
    <div className={styles['fields']}>
      <Field label={nls.t('features.tree.associations.person')}>
        <Select value={draft.otherPersonId} onChange={(event) => set({ otherPersonId: event.target.value })}>
          <option value="">{nls.t('features.tree.associations.person.none')}</option>
          {others.map((person) => (
            <option key={person.id} value={person.id}>
              {displayName(person)}
            </option>
          ))}
        </Select>
      </Field>
      <FieldGrid columns={2}>
        <Field label={nls.t('features.tree.associations.relationship')}>
          <Input value={draft.relationship} onChange={(event) => set({ relationship: event.target.value })} />
        </Field>
        <Field label={nls.t('features.tree.associations.role')}>
          <Input value={draft.role} onChange={(event) => set({ role: event.target.value })} />
        </Field>
        <Field label={nls.t('features.tree.associations.specificType')}>
          <Input value={draft.specificType} onChange={(event) => set({ specificType: event.target.value })} />
        </Field>
        <Field label={nls.t('features.tree.associations.confidence')}>
          <Input value={draft.confidence} onChange={(event) => set({ confidence: event.target.value })} />
        </Field>
      </FieldGrid>
      <Field label={nls.t('features.tree.associations.phrase')}>
        <Input value={draft.phrase} onChange={(event) => set({ phrase: event.target.value })} />
      </Field>
      <Checkbox
        label={nls.t('features.tree.associations.primary')}
        checked={draft.primary}
        onChange={(event) => set({ primary: event.target.checked })}
      />
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

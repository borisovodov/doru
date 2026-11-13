import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { PersonRecord } from '@doru/core';
import { nls } from '../../nls';
import { displayName } from '../format/format';
import { Button } from '../../atoms/button/Button';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { Field } from '../../atoms/field/Field';
import { Select } from '../../atoms/form/Select';
import { ActionBar } from '../../patterns/action-bar/ActionBar';
import { AttachmentRow, RowList } from '../../patterns/row-list/RowList';
import { SectionCard } from '../../patterns/section-card/SectionCard';

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
    <SectionCard
      title={nls.t('features.tree.aliases.title')}
      actions={
        !adding ? (
          <Button
            size="sm"
            variant="primary"
            icon={<Plus size={13} aria-hidden="true" />}
            onClick={() => setAdding(true)}
          >
            {nls.t('features.tree.aliases.add')}
          </Button>
        ) : null
      }
    >
      {aliases.length === 0 && !adding ? <EmptyText>{nls.t('features.tree.aliases.empty')}</EmptyText> : null}
      {aliases.length > 0 ? (
        <RowList>
          {aliases.map((alias) => {
            const other = persons.find((person) => person.id === alias.aliasId);
            return (
              <AttachmentRow
                key={alias.id}
                value={other ? displayName(other) : alias.aliasId}
                actions={
                  <IconButton
                    size="sm"
                    label={nls.t('features.tree.aliases.remove')}
                    icon={<X size={13} aria-hidden="true" />}
                    onClick={() => void onDelete(alias.id, personId, alias.aliasId)}
                  />
                }
              />
            );
          })}
        </RowList>
      ) : null}
      {adding ? (
        <>
          <Field label={nls.t('features.tree.aliases.person')}>
            <Select value={selected} onChange={(event) => setSelected(event.target.value)}>
              <option value="">{nls.t('features.tree.aliases.none')}</option>
              {others.map((person) => (
                <option key={person.id} value={person.id}>
                  {displayName(person)}
                </option>
              ))}
            </Select>
          </Field>
          <ActionBar>
            <Button variant="primary" onClick={() => void save()}>
              {nls.t('features.tree.save')}
            </Button>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              {nls.t('features.tree.fact.cancel')}
            </Button>
          </ActionBar>
        </>
      ) : null}
    </SectionCard>
  );
}

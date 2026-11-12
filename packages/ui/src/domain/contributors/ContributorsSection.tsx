import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { SubmitterRecord } from '@doru/core';
import { nls } from '../../nls';
import { Button } from '../../atoms/button/Button';
import { Chip } from '../../atoms/display/Chip';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Field } from '../../atoms/field/Field';
import { Select } from '../../atoms/form/Select';
import { ActionBar } from '../../patterns/action-bar/ActionBar';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import styles from './ContributorsSection.module.css';

/**
 * The submitters who contributed a record (GEDCOM SUBM on INDI/FAM):
 * chips with the submitter names, an add picker and per-chip removal.
 */
export function ContributorsSection({
  targetType,
  targetId,
  submitters,
  links,
  onAdd,
  onDelete,
}: {
  targetType: string;
  targetId: string;
  submitters: SubmitterRecord[];
  links: Array<{ id: string; submitterId: string; targetType: string; targetId: string }>;
  onAdd: (submitterId: string, targetType: string, targetId: string) => Promise<void>;
  onDelete: (id: string, submitterId: string, targetType: string, targetId: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState('');
  const byId = new Map(submitters.map((submitter) => [submitter.id, submitter]));
  const available = submitters.filter((submitter) => !links.some((link) => link.submitterId === submitter.id));

  const save = async () => {
    if (selected === '') {
      return;
    }
    await onAdd(selected, targetType, targetId);
    setSelected('');
    setAdding(false);
  };

  return (
    <SectionCard
      title={nls.t('features.tree.contributors.title')}
      actions={
        !adding ? (
          <Button
            size="sm"
            variant="primary"
            icon={<Plus size={13} aria-hidden="true" />}
            onClick={() => setAdding(true)}
          >
            {nls.t('features.tree.contributors.add')}
          </Button>
        ) : null
      }
    >
      {links.length === 0 && !adding ? <EmptyText>{nls.t('features.tree.contributors.empty')}</EmptyText> : null}
      {links.length > 0 ? (
        <div className={styles['chips']}>
          {links.map((link) => (
            <Chip key={link.id}>
              {byId.get(link.submitterId)?.name ?? link.submitterId}
              <IconButton
                size="sm"
                label={nls.t('features.tree.contributors.remove')}
                icon={<X size={12} aria-hidden="true" />}
                onClick={() => void onDelete(link.id, link.submitterId, link.targetType, link.targetId)}
              />
            </Chip>
          ))}
        </div>
      ) : null}
      {adding ? (
        <>
          <Field label={nls.t('features.tree.contributors.title')}>
            <Select value={selected} onChange={(event) => setSelected(event.target.value)}>
              <option value="">{nls.t('features.tree.contributors.none')}</option>
              {available.map((submitter) => (
                <option key={submitter.id} value={submitter.id}>
                  {submitter.name}
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

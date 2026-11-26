import { useState } from 'react';
import { Plus, Unlink } from 'lucide-react';
import type { RecordSubmitterLink, SubmitterRecord } from '@doru/core';
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
  canAdd = true,
}: {
  targetType: string;
  targetId: string;
  submitters: SubmitterRecord[];
  links: RecordSubmitterLink[];
  onAdd: (
    submitterId: string,
    targetType: string,
    targetId: string,
    kind: RecordSubmitterLink['kind'],
  ) => Promise<void>;
  onDelete: (
    id: string,
    submitterId: string,
    targetType: string,
    targetId: string,
    kind: RecordSubmitterLink['kind'],
  ) => Promise<void>;
  /** False for targets that must not gain new contributor links (tasks and media links). */
  canAdd?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState('');
  const [kind, setKind] = useState<RecordSubmitterLink['kind']>('contributor');
  const byId = new Map(submitters.map((submitter) => [submitter.id, submitter]));
  const available = submitters.filter(
    (submitter) => !links.some((link) => link.submitterId === submitter.id && (link.kind ?? 'contributor') === kind),
  );

  const save = async () => {
    if (selected === '' || !available.some((submitter) => submitter.id === selected)) {
      return;
    }
    await onAdd(selected, targetType, targetId, kind);
    setSelected('');
    setAdding(false);
  };

  // A target that cannot gain contributors (a task or media link) hides the
  // empty section; legacy links stay visible and removable.
  if (!canAdd && links.length === 0) {
    return null;
  }

  return (
    <SectionCard
      title={nls.t('features.tree.contributors.title')}
      actions={
        canAdd && !adding ? (
          <Button
            size="sm"
            variant="secondary"
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
              {(link.kind ?? 'contributor') !== 'contributor' && (
                <span className={styles['kind']}>
                  {nls.t(`features.tree.contributors.kind.${link.kind ?? 'contributor'}`)}
                </span>
              )}
              <IconButton
                size="sm"
                label={nls.t('features.tree.contributors.remove')}
                icon={<Unlink size={12} aria-hidden="true" />}
                onClick={() =>
                  void onDelete(link.id, link.submitterId, link.targetType, link.targetId, link.kind ?? 'contributor')
                }
              />
            </Chip>
          ))}
        </div>
      ) : null}
      {canAdd && adding ? (
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
          {targetType === 'person' && (
            <Field label={nls.t('features.tree.contributors.kind')}>
              <Select
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value as RecordSubmitterLink['kind']);
                  setSelected('');
                }}
              >
                <option value="contributor">{nls.t('features.tree.contributors.kind.contributor')}</option>
                <option value="ancestor_interest">{nls.t('features.tree.contributors.kind.ancestor_interest')}</option>
                <option value="descendant_interest">
                  {nls.t('features.tree.contributors.kind.descendant_interest')}
                </option>
              </Select>
            </Field>
          )}
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

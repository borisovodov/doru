import { useState } from 'react';
import { Plus, Unlink } from 'lucide-react';
import type { SubmitterLink, SubmitterRecord } from '@doru/core';
import { nls } from '../../nls';
import { Button } from '../../atoms/button/Button';
import { Chip } from '../../atoms/display/Chip';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Field } from '../../atoms/field/Field';
import { Select } from '../../atoms/form/Select';
import { ActionBar } from '../../patterns/action-bar/ActionBar';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import styles from './SubmitterLinksSection.module.css';

export type SubmitterLinkKind = NonNullable<SubmitterLink['kind']>;

/**
 * A list of record-to-submitter links, shared by ordinary contributors and
 * research interests. The caller owns the title and the set of kinds shown.
 */
export function SubmitterLinksSection({
  title,
  addLabel,
  emptyLabel,
  removeLabel,
  submitterFieldLabel,
  kindFieldLabel,
  targetType,
  targetId,
  submitters,
  links,
  kinds,
  defaultKind,
  showKindLabel,
  onAdd,
  onDelete,
  canAdd = true,
}: {
  title: string;
  addLabel: string;
  emptyLabel: string;
  removeLabel: string;
  submitterFieldLabel: string;
  kindFieldLabel?: string | undefined;
  targetType: string;
  targetId: string;
  submitters: SubmitterRecord[];
  links: SubmitterLink[];
  kinds: readonly SubmitterLinkKind[];
  defaultKind: SubmitterLinkKind;
  showKindLabel: boolean;
  onAdd: (submitterId: string, targetType: string, targetId: string, kind: SubmitterLink['kind']) => Promise<void>;
  onDelete: (
    id: string,
    submitterId: string,
    targetType: string,
    targetId: string,
    kind: SubmitterLink['kind'],
  ) => Promise<void>;
  /** False when the caller wants a read-only list of legacy links. */
  canAdd?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState('');
  const [kind, setKind] = useState<SubmitterLinkKind>(defaultKind);
  const byId = new Map(submitters.map((submitter) => [submitter.id, submitter]));
  const visibleLinks = links.filter((link) => kinds.includes(link.kind ?? 'contributor'));
  const available = submitters.filter(
    (submitter) =>
      !visibleLinks.some((link) => link.submitterId === submitter.id && (link.kind ?? 'contributor') === kind),
  );

  const save = async () => {
    if (selected === '' || !available.some((submitter) => submitter.id === selected)) {
      return;
    }
    await onAdd(selected, targetType, targetId, kind);
    setSelected('');
    setAdding(false);
  };

  if (!canAdd && visibleLinks.length === 0) {
    return null;
  }

  return (
    <SectionCard
      title={title}
      actions={
        canAdd && !adding ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus size={13} aria-hidden="true" />}
            onClick={() => setAdding(true)}
          >
            {addLabel}
          </Button>
        ) : null
      }
    >
      {visibleLinks.length === 0 && !adding ? <EmptyText>{emptyLabel}</EmptyText> : null}
      {visibleLinks.length > 0 ? (
        <div className={styles['chips']}>
          {visibleLinks.map((link) => (
            <Chip key={link.id}>
              {byId.get(link.submitterId)?.name ?? link.submitterId}
              {showKindLabel ? (
                <span className={styles['kind']}>
                  {nls.t(`features.tree.contributors.kind.${link.kind ?? 'contributor'}`)}
                </span>
              ) : null}
              <IconButton
                size="sm"
                label={removeLabel}
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
          <Field label={submitterFieldLabel}>
            <Select value={selected} onChange={(event) => setSelected(event.target.value)}>
              <option value="">{nls.t('features.tree.contributors.none')}</option>
              {available.map((submitter) => (
                <option key={submitter.id} value={submitter.id}>
                  {submitter.name}
                </option>
              ))}
            </Select>
          </Field>
          {kinds.length > 1 && kindFieldLabel !== undefined ? (
            <Field label={kindFieldLabel}>
              <Select
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value as SubmitterLinkKind);
                  setSelected('');
                }}
              >
                {kinds.map((option) => (
                  <option key={option} value={option}>
                    {nls.t(`features.tree.contributors.kind.${option}`)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
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

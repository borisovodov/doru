import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { SubmitterRecord } from '@doru/core';
import { nls } from '../nls';
import './AttachmentsSection.css';

/**
 * The submitters who contributed a record (GEDCOM SUBM on INDI/FAM):
 * chips with the submitter names, an add picker and per-chip removal.
 * Shared by the person and family editors.
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
    <div className="person-section">
      <h3>{nls.t('features.tree.contributors.title')}</h3>
      {links.length === 0 && !adding && <p className="notes-empty">{nls.t('features.tree.contributors.empty')}</p>}
      <div className="tag-chips">
        {links.map((link) => (
          <span key={link.id} className="tag-chip">
            {byId.get(link.submitterId)?.name ?? link.submitterId}
            <button
              className="icon-button"
              title={nls.t('features.tree.contributors.remove')}
              onClick={() => void onDelete(link.id, link.submitterId, link.targetType, link.targetId)}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      {adding ? (
        <div className="attachment-add">
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">{nls.t('features.tree.contributors.none')}</option>
            {available.map((submitter) => (
              <option key={submitter.id} value={submitter.id}>
                {submitter.name}
              </option>
            ))}
          </select>
          <button className="add-button" onClick={() => void save()}>
            {nls.t('features.tree.save')}
          </button>
          <button className="plain-button" onClick={() => setAdding(false)}>
            {nls.t('features.tree.fact.cancel')}
          </button>
        </div>
      ) : (
        <button className="add-button" onClick={() => setAdding(true)}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.contributors.add')}
        </button>
      )}
    </div>
  );
}

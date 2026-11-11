import type { ChangeRecord } from '@doru/core';
import { nls } from '../nls';
import { formatDate } from './format';
import './AttachmentsSection.css';

/** The read-only change log of the person (created/changed rows). */
export function ChangesSection({ changes }: { changes: ChangeRecord[] }) {
  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.history.title')}</h3>
      {changes.length === 0 ? (
        <p className="notes-empty">{nls.t('features.tree.history.empty')}</p>
      ) : (
        <ul className="attachment-list">
          {changes.map((change) => (
            <li key={change.id}>
              <span className="attachment-kind">
                {change.kind === 'created'
                  ? nls.t('features.tree.history.created')
                  : nls.t('features.tree.history.changed')}
              </span>
              <span className="attachment-value">
                {change.date ? formatDate(change.date) : ''}
                {change.user ? ` — ${change.user}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

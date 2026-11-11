import { Archive, User } from 'lucide-react';
import type { RepositoryRecord, SubmitterRecord } from '@doru/core';
import { nls } from '../nls';
import './sidebar.css';
import './SidebarRegistries.css';

/**
 * The Registries sidebar: the repository and submitter lists. Clicking an
 * entry opens the registries tab (which holds the full editors and the
 * project header).
 */
export function SidebarRegistries({
  repositories,
  submitters,
  onOpenRegistries,
}: {
  repositories: RepositoryRecord[];
  submitters: SubmitterRecord[];
  onOpenRegistries: () => void;
}) {
  return (
    <div className="side-registries">
      <h3 className="side-registries-title">{nls.t('features.tree.registries.repositories')}</h3>
      {repositories.length === 0 ? (
        <p className="side-registries-note">{nls.t('features.tree.registries.repositories.empty')}</p>
      ) : (
        <ul className="side-section-list">
          {repositories.map((repository) => (
            <li key={repository.id} className="entity-card clickable" onClick={onOpenRegistries}>
              <span className="entity-card-icon">
                <Archive size={15} aria-hidden="true" />
              </span>
              <span className="entity-card-body">
                <span className="entity-card-title">{repository.name || '—'}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="side-registries-title">{nls.t('features.tree.registries.submitters')}</h3>
      {submitters.length === 0 ? (
        <p className="side-registries-note">{nls.t('features.tree.registries.submitters.empty')}</p>
      ) : (
        <ul className="side-section-list">
          {submitters.map((submitter) => (
            <li key={submitter.id} className="entity-card clickable" onClick={onOpenRegistries}>
              <span className="entity-card-icon">
                <User size={15} aria-hidden="true" />
              </span>
              <span className="entity-card-body">
                <span className="entity-card-title">{submitter.name || '—'}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

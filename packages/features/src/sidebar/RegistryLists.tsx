import { Archive, User } from 'lucide-react';
import type { RepositoryRecord, SubmitterRecord } from '@doru/core';
import { nls } from '../nls';
import './sidebar.css';

/** The repository list of the Sources sidebar; clicking opens the repository tab. */
export function RepositoryList({
  repositories,
  onOpenRepository,
}: {
  repositories: RepositoryRecord[];
  onOpenRepository: (repositoryId: string) => void;
}) {
  if (repositories.length === 0) {
    return <p className="side-registries-note">{nls.t('features.tree.repository.empty')}</p>;
  }
  return (
    <ul className="side-section-list">
      {repositories.map((repository) => (
        <li key={repository.id} className="entity-card clickable" onClick={() => onOpenRepository(repository.id)}>
          <span className="entity-card-icon">
            <Archive size={15} aria-hidden="true" />
          </span>
          <span className="entity-card-body">
            <span className="entity-card-title">{repository.name || '—'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The submitter list of the Sources sidebar; clicking opens the submitter tab. */
export function SubmitterList({
  submitters,
  onOpenSubmitter,
}: {
  submitters: SubmitterRecord[];
  onOpenSubmitter: (submitterId: string) => void;
}) {
  if (submitters.length === 0) {
    return <p className="side-registries-note">{nls.t('features.tree.submitter.empty')}</p>;
  }
  return (
    <ul className="side-section-list">
      {submitters.map((submitter) => (
        <li key={submitter.id} className="entity-card clickable" onClick={() => onOpenSubmitter(submitter.id)}>
          <span className="entity-card-icon">
            <User size={15} aria-hidden="true" />
          </span>
          <span className="entity-card-body">
            <span className="entity-card-title">{submitter.name || '—'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

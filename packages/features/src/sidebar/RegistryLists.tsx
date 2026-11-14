import { Archive, BookMarked, MapPin, User } from 'lucide-react';
import type { AddressRecord, RepositoryRecord, SubmitterRecord, TitleRecord } from '@doru/core';
import { EntityCard } from '@doru/ui';
import { addressLabel } from '@doru/ui/domain';
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
        <li key={repository.id}>
          <EntityCard
            icon={<Archive size={15} aria-hidden="true" />}
            title={repository.name || '—'}
            onClick={() => onOpenRepository(repository.id)}
          />
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
        <li key={submitter.id}>
          <EntityCard
            icon={<User size={15} aria-hidden="true" />}
            title={submitter.name || '—'}
            onClick={() => onOpenSubmitter(submitter.id)}
          />
        </li>
      ))}
    </ul>
  );
}

/** The bibliographic-title list of the Sources sidebar; clicking opens the title tab. */
/** The address list of the Sources sidebar; clicking opens the address tab. */
export function AddressList({
  addresses,
  onOpenAddress,
}: {
  addresses: AddressRecord[];
  onOpenAddress: (addressId: string) => void;
}) {
  if (addresses.length === 0) {
    return <p className="side-registries-note">{nls.t('features.tree.address.empty')}</p>;
  }
  return (
    <ul className="side-section-list">
      {addresses.map((address) => (
        <li key={address.id}>
          <EntityCard
            icon={<MapPin size={15} aria-hidden="true" />}
            title={addressLabel(address) || '—'}
            onClick={() => onOpenAddress(address.id)}
          />
        </li>
      ))}
    </ul>
  );
}

export function TitleList({ titles, onOpenTitle }: { titles: TitleRecord[]; onOpenTitle: (titleId: string) => void }) {
  if (titles.length === 0) {
    return <p className="side-registries-note">{nls.t('features.tree.title.empty')}</p>;
  }
  return (
    <ul className="side-section-list">
      {titles.map((title) => (
        <li key={title.id}>
          <EntityCard
            icon={<BookMarked size={15} aria-hidden="true" />}
            title={title.name || '—'}
            subtitle={title.author !== undefined ? title.author : null}
            onClick={() => onOpenTitle(title.id)}
          />
        </li>
      ))}
    </ul>
  );
}

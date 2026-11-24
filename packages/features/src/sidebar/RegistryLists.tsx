import { Archive, BookMarked, MapPin, User } from 'lucide-react';
import type { AddressRecord, RepositoryRecord, SubmitterRecord, TitleRecord } from '@doru/core';
import { EntityRow, SideBarEmpty, SideBarList } from '@doru/ui';
import { addressLabel } from '@doru/ui/domain';
import { nls } from '../nls';
import './sidebar.css';

/** The repository list of the Sources sidebar; clicking opens the repository tab. */
export function RepositoryList({
  repositories,
  onOpenRepository,
  selectedId,
}: {
  repositories: RepositoryRecord[];
  onOpenRepository: (repositoryId: string) => void;
  selectedId?: string | undefined;
}) {
  if (repositories.length === 0) {
    return <SideBarEmpty>{nls.t('features.tree.repository.empty')}</SideBarEmpty>;
  }
  return (
    <SideBarList>
      {repositories.map((repository) => (
        <li key={repository.id}>
          <EntityRow
            selected={repository.id === selectedId}
            icon={<Archive size={15} aria-hidden="true" />}
            title={repository.name || '—'}
            onClick={() => onOpenRepository(repository.id)}
          />
        </li>
      ))}
    </SideBarList>
  );
}

/** The submitter list of the Sources sidebar; clicking opens the submitter tab. */
export function SubmitterList({
  submitters,
  onOpenSubmitter,
  selectedId,
}: {
  submitters: SubmitterRecord[];
  onOpenSubmitter: (submitterId: string) => void;
  selectedId?: string | undefined;
}) {
  if (submitters.length === 0) {
    return <SideBarEmpty>{nls.t('features.tree.submitter.empty')}</SideBarEmpty>;
  }
  return (
    <SideBarList>
      {submitters.map((submitter) => (
        <li key={submitter.id}>
          <EntityRow
            selected={submitter.id === selectedId}
            icon={<User size={15} aria-hidden="true" />}
            title={submitter.name || '—'}
            onClick={() => onOpenSubmitter(submitter.id)}
          />
        </li>
      ))}
    </SideBarList>
  );
}

/** The bibliographic-title list of the Sources sidebar; clicking opens the title tab. */
/** The address list of the Sources sidebar; clicking opens the address tab. */
export function AddressList({
  addresses,
  onOpenAddress,
  selectedId,
}: {
  addresses: AddressRecord[];
  onOpenAddress: (addressId: string) => void;
  selectedId?: string | undefined;
}) {
  if (addresses.length === 0) {
    return <SideBarEmpty>{nls.t('features.tree.address.empty')}</SideBarEmpty>;
  }
  return (
    <SideBarList>
      {addresses.map((address) => (
        <li key={address.id}>
          <EntityRow
            selected={address.id === selectedId}
            icon={<MapPin size={15} aria-hidden="true" />}
            title={addressLabel(address) || '—'}
            onClick={() => onOpenAddress(address.id)}
          />
        </li>
      ))}
    </SideBarList>
  );
}

export function TitleList({
  titles,
  onOpenTitle,
  selectedId,
}: {
  titles: TitleRecord[];
  onOpenTitle: (titleId: string) => void;
  selectedId?: string | undefined;
}) {
  if (titles.length === 0) {
    return <SideBarEmpty>{nls.t('features.tree.title.empty')}</SideBarEmpty>;
  }
  return (
    <SideBarList>
      {titles.map((title) => (
        <li key={title.id}>
          <EntityRow
            selected={title.id === selectedId}
            icon={<BookMarked size={15} aria-hidden="true" />}
            title={title.name || '—'}
            subtitle={title.author !== undefined ? title.author : null}
            onClick={() => onOpenTitle(title.id)}
          />
        </li>
      ))}
    </SideBarList>
  );
}

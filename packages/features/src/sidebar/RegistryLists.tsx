import { useMemo } from 'react';
import { Archive, BookMarked, BookOpenText, MapPin, NotebookText, Tag as TagIcon, Trash2, User } from 'lucide-react';
import type {
  AddressRecord,
  CitationRecord,
  NoteRecord,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
  TitleRecord,
} from '@doru/core';
import { EntityCard, IconButton } from '@doru/ui';
import { addressLabel, createTaskTargetLabeler, type TaskTargetData } from '@doru/ui/domain';
import { nls } from '../nls';
import styles from './RegistryLists.module.css';
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

/** Every tag in the tree; orphaned tags (no links) stay reachable and deletable. */
export function TagsList({
  tags,
  tagLinks,
  onDeleteTag,
}: {
  tags: TagRecord[];
  tagLinks: TagLinkRecord[];
  onDeleteTag: (tag: TagRecord) => void;
}) {
  if (tags.length === 0) {
    return <p className="side-registries-note">{nls.t('features.tree.tags.empty')}</p>;
  }
  const counts = new Map<string, number>();
  for (const link of tagLinks) {
    counts.set(link.tagId, (counts.get(link.tagId) ?? 0) + 1);
  }
  return (
    <ul className="side-section-list">
      {tags.map((tag) => {
        const count = counts.get(tag.id) ?? 0;
        return (
          <li key={tag.id} className={styles['tagRow']}>
            <EntityCard
              icon={<TagIcon size={15} aria-hidden="true" />}
              title={tag.name}
              subtitle={count === 0 ? nls.t('features.tree.tags.orphan') : null}
              meta={count > 0 ? count : null}
            />
            <IconButton
              size="sm"
              label={nls.t('features.tree.tags.delete')}
              icon={<Trash2 size={13} aria-hidden="true" />}
              onClick={() => onDeleteTag(tag)}
            />
          </li>
        );
      })}
    </ul>
  );
}

/** Every note in the tree, with the record it belongs to. */
export function NotesList({ notes, targetData }: { notes: NoteRecord[]; targetData: TaskTargetData }) {
  const targetLabel = useMemo(() => createTaskTargetLabeler(targetData), [targetData]);
  if (notes.length === 0) {
    return <p className="side-registries-note">{nls.t('features.tree.notes.empty')}</p>;
  }
  return (
    <ul className="side-section-list">
      {notes.map((note) => (
        <li key={note.id}>
          <EntityCard
            icon={<NotebookText size={15} aria-hidden="true" />}
            title={note.text}
            subtitle={(() => {
              const targets = note.links ?? [];
              if (targets.length > 0) {
                return [...new Set(targets.map((link) => targetLabel(link.targetType, link.targetId)))].join(' · ');
              }
              return note.targetType !== undefined && note.targetId !== undefined
                ? targetLabel(note.targetType, note.targetId)
                : null;
            })()}
          />
          <details className="side-note-details">
            <summary>{nls.t('features.tree.notes.showFull')}</summary>
            <p className="side-registries-note">{note.text}</p>
          </details>
        </li>
      ))}
    </ul>
  );
}

/** Every citation in the tree; the card opens the cited source. */
export function CitationsList({
  citations,
  sources,
  targetData,
  onOpenSource,
}: {
  citations: CitationRecord[];
  sources: SourceRecord[];
  targetData: TaskTargetData;
  onOpenSource: (sourceId: string) => void;
}) {
  if (citations.length === 0) {
    return <p className="side-registries-note">{nls.t('features.tree.citations.empty')}</p>;
  }
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const targetLabel = createTaskTargetLabeler(targetData);
  return (
    <ul className="side-section-list">
      {citations.map((citation) => {
        const source = sourceById.get(citation.sourceId);
        const details = [
          citation.page,
          citation.description,
          targetLabel(citation.targetType, citation.targetId),
        ].filter((part): part is string => part !== undefined && part !== '');
        return (
          <li key={citation.id}>
            <EntityCard
              icon={<BookOpenText size={15} aria-hidden="true" />}
              title={source?.title ?? citation.sourceId}
              subtitle={details.length > 0 ? details.join(' · ') : null}
              onClick={() => onOpenSource(citation.sourceId)}
            />
          </li>
        );
      })}
    </ul>
  );
}

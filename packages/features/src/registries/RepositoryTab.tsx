import { useState } from 'react';
import { Input, useAutoFocusSelect } from '@doru/ui';
import { SectionCard } from '@doru/ui';
import { Field } from '@doru/ui';
import { Archive } from 'lucide-react';
import type { AddressRecord, RepositoryRecord, SourceRecord, TitleRecord } from '@doru/core';
import { AttachmentsPanel, CitationAttachments, NoteAttachments, useAttachments } from '../attachments';
import { AutoSaveError } from '../autoSaveFeedback';
import { MediaSection } from '../media/MediaSection';
import { EntityTab } from '../sidebar';
import type { MediaTargetApi, RegistriesEditorApi } from '../person/types';
import type { MediaWithPath } from '@doru/ui/domain';
import {
  AddressLinkField,
  ContactsSection,
  ContributorsSection,
  IdentifiersSection,
  NotesSection,
  RestrictionsSection,
  SourcesSection,
  TagsSection,
  TasksSection,
  SourceLink,
  addressDraftEmpty,
  addressDraftMatches,
  addressLabel,
} from '@doru/ui/domain';
import { nls } from '../nls';
import { Button, DangerZone, useAutoSaveOnBlur } from '@doru/ui';
import { EntityViewCard } from '@doru/ui';
import { useRegistryAddress } from './useRegistryAddress';

export function RepositoryTab({
  entityId,
  repositories,
  addresses,
  api,
  sources,
  titles,
  media,
  mediaApi,
  onOpenSource,
  onOpenTitle,
  onOpenMedia,
  onOpenAddress,
  onClose,
  onCreated,
}: {
  entityId: string;
  repositories: RepositoryRecord[];
  addresses: AddressRecord[];
  api: RegistriesEditorApi;
  sources: SourceRecord[];
  titles: TitleRecord[];
  media: MediaWithPath[];
  mediaApi: MediaTargetApi;
  onOpenSource: (sourceId: string) => void;
  onOpenTitle: (titleId: string) => void;
  onOpenMedia: (mediaId: string) => void;
  onOpenAddress: (addressId: string) => void;
  onClose: () => void;
  onCreated: (realId: string) => void;
}) {
  const repositoryId = entityId;
  const isNew = repositoryId.startsWith('new:');
  const record = repositories.find((repository) => repository.id === repositoryId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tree.repository.notFound')}</p>;
  }
  return (
    <RepositoryTabBody
      record={record}
      addresses={addresses}
      isNew={isNew}
      api={api}
      sources={sources}
      titles={titles}
      media={media}
      mediaApi={mediaApi}
      onOpenSource={onOpenSource}
      onOpenTitle={onOpenTitle}
      onOpenMedia={onOpenMedia}
      onOpenAddress={onOpenAddress}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function RepositoryTabBody({
  record,
  addresses,
  isNew,
  api,
  sources,
  titles,
  media,
  mediaApi,
  onOpenSource,
  onOpenTitle,
  onOpenMedia,
  onOpenAddress,
  onClose,
  onCreated,
}: {
  record: RepositoryRecord | undefined;
  addresses: AddressRecord[];
  isNew: boolean;
  api: RegistriesEditorApi;
  sources: SourceRecord[];
  titles: TitleRecord[];
  media: MediaWithPath[];
  mediaApi: MediaTargetApi;
  onOpenSource: (sourceId: string) => void;
  onOpenTitle: (titleId: string) => void;
  onOpenMedia: (mediaId: string) => void;
  onOpenAddress: (addressId: string) => void;
  onClose: () => void;
  onCreated: (realId: string) => void;
}) {
  const base: RepositoryRecord = record ?? { id: crypto.randomUUID(), name: '' };
  const nameRef = useAutoFocusSelect<HTMLInputElement>(isNew);
  const [lastSaved, setLastSaved] = useState<RepositoryRecord | undefined>(record);
  const [name, setName] = useState(isNew ? nls.t('features.tree.repository.newRepository') : base.name);
  const [linkedAddressId, setLinkedAddressId] = useState<string | undefined>(base.addressId);
  const { address, setAddress, addressBefore, addressSaveFailed, saveAddress, unlinkAddress, clearAddressSaveFailure } =
    useRegistryAddress(api, linkedAddressId);
  const addressText = addressBefore !== undefined ? addressLabel(addressBefore) : '';
  const targetId = (lastSaved ?? record)?.id;
  const {
    notes: repositoryNotes,
    allNotes,
    citations: repositoryCitations,
    tags,
    tagLinks,
    identifiers,
    contacts,
    restrictions,
    submitters,
    contributors,
    refresh: refreshAttachments,
  } = useAttachments('repository', targetId, api, true);

  const selectAddress = (addressId: string | undefined) => {
    setLinkedAddressId(addressId);
    if (addressId === undefined) {
      unlinkAddress();
    }
  };

  const save = async () => {
    const next: RepositoryRecord = { id: base.id, xref: base.xref, name: name.trim() };
    if (linkedAddressId === undefined) {
      try {
        next.addressId = await saveAddress();
      } catch {
        return;
      }
    } else {
      next.addressId = linkedAddressId;
    }
    if (isNew && lastSaved === undefined) {
      await api.addRepository(next);
      onCreated(next.id);
    } else {
      await api.updateRepository(lastSaved ?? base, next);
    }
    clearAddressSaveFailure();
    setLastSaved(next);
  };

  const remove = async () => {
    const target = lastSaved ?? base;
    await api.deleteRepository(target);
    onClose();
  };

  const usedBySources =
    targetId !== undefined
      ? sources.filter((source) => (source.repositories ?? []).some((link) => link.repositoryId === targetId))
      : [];
  const usedByTitles = targetId !== undefined ? titles.filter((title) => title.repositoryId === targetId) : [];
  const persisted = lastSaved ?? record;
  const autoSave = useAutoSaveOnBlur({
    enabled: !isNew,
    isDirty: () => {
      if (persisted === undefined || name.trim() === '') {
        return false;
      }
      const addressDirty =
        linkedAddressId === undefined &&
        (addressBefore !== undefined ? !addressDraftMatches(address, addressBefore) : !addressDraftEmpty(address));
      const effectiveAddressId = linkedAddressId ?? addressBefore?.id;
      return name.trim() !== persisted.name || effectiveAddressId !== persisted.addressId || addressDirty;
    },
    save,
  });

  return (
    <EntityTab onBlur={autoSave.onBlur}>
      <EntityViewCard
        media={<Archive size={20} aria-hidden="true" />}
        title={name.trim() || (isNew ? nls.t('features.tree.repository.newRepository') : '—')}
        subtitle={addressText !== '' ? addressText : null}
        actions={
          isNew ? (
            <Button
              variant="primary"
              size="sm"
              data-autosave-skip="true"
              disabled={name.trim() === ''}
              onClick={() => void save()}
            >
              {nls.t('features.tree.create')}
            </Button>
          ) : undefined
        }
      />
      <AutoSaveError failed={autoSave.failed} onRetry={autoSave.retry} />

      <SectionCard title={nls.t('features.tree.details')}>
        <Field label={nls.t('features.tree.repository.name')}>
          <Input ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <AddressLinkField
          addresses={addresses}
          addressId={linkedAddressId}
          address={address}
          onSelect={selectAddress}
          onChange={setAddress}
          onOpen={onOpenAddress}
          renderAttachments={(lineId) => (
            <AttachmentsPanel
              targetType="address_line"
              targetId={lineId}
              api={api}
              sources={sources}
              onOpenSource={onOpenSource}
            />
          )}
        />
        {addressSaveFailed && (
          <p className="side-registries-note" role="alert">
            {nls.t('features.tree.address.saveFailed')}
          </p>
        )}
      </SectionCard>
      {targetId !== undefined && (
        <>
          <SectionCard title={nls.t('features.tree.repository.usedBySources')}>
            {usedBySources.length === 0 ? (
              <p className="side-registries-note">{nls.t('features.tree.repository.usedBySources.empty')}</p>
            ) : (
              <ul className="side-section-list">
                {usedBySources.map((source) => (
                  <li key={source.id}>
                    <SourceLink
                      title={source.title || source.abbreviation || source.id}
                      onClick={() => onOpenSource(source.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard title={nls.t('features.tree.repository.usedByTitles')}>
            {usedByTitles.length === 0 ? (
              <p className="side-registries-note">{nls.t('features.tree.repository.usedByTitles.empty')}</p>
            ) : (
              <ul className="side-section-list">
                {usedByTitles.map((title) => (
                  <li key={title.id}>
                    <SourceLink
                      title={title.name || title.abbreviation || title.id}
                      onClick={() => onOpenTitle(title.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SourcesSection
            targetType="repository"
            targetId={targetId}
            sources={sources}
            citations={repositoryCitations}
            refresh={refreshAttachments}
            onAddSource={api.addSource}
            onAttachSource={api.attachSource}
            onDetachCitation={api.detachCitation}
            onUpdateCitation={api.updateCitation}
            onOpenSource={onOpenSource}
            renderCitationAttachments={(citation) => (
              <CitationAttachments citation={citation} api={api} sources={sources} onOpenSource={onOpenSource} />
            )}
          />
          <NotesSection
            targetType="repository"
            targetId={targetId}
            notes={repositoryNotes}
            availableNotes={allNotes}
            onAdd={async (text) => {
              await api.addNote({ id: crypto.randomUUID(), text, targetType: 'repository', targetId });
              await refreshAttachments();
            }}
            onUpdate={async (before, after, context) => {
              await api.updateNote(before, after, context);
              await refreshAttachments();
            }}
            onAttach={async (noteId) => {
              await api.attachNote(noteId, { id: crypto.randomUUID(), targetType: 'repository', targetId });
              await refreshAttachments();
            }}
            onDetach={async (note, link) => {
              await api.detachNote(note, link);
              await refreshAttachments();
            }}
            onDelete={async (note) => {
              await api.deleteNote(note);
              await refreshAttachments();
            }}
            renderAttachments={(note) => (
              <NoteAttachments note={note} api={api} sources={sources} onOpenSource={onOpenSource} />
            )}
          />
          <IdentifiersSection
            targetType="repository"
            targetId={targetId}
            identifiers={identifiers}
            onAdd={async (identifier) => {
              await api.addIdentifier(identifier);
              await refreshAttachments();
            }}
            onUpdate={async (before, after) => {
              await api.updateIdentifier(before, after);
              await refreshAttachments();
            }}
            onDelete={async (identifier) => {
              await api.deleteIdentifier(identifier);
              await refreshAttachments();
            }}
          />
          <ContactsSection
            targetType="repository"
            targetId={targetId}
            contacts={contacts}
            onAdd={async (contact) => {
              await api.addContact(contact);
              await refreshAttachments();
            }}
            onUpdate={async (before, after) => {
              await api.updateContact(before, after);
              await refreshAttachments();
            }}
            onDelete={async (contact) => {
              await api.deleteContact(contact);
              await refreshAttachments();
            }}
          />
          <RestrictionsSection
            targetType="repository"
            targetId={targetId}
            restrictions={restrictions}
            onAdd={async (restriction) => {
              await api.addRestriction(restriction);
              await refreshAttachments();
            }}
            onUpdate={async (before, after) => {
              await api.updateRestriction(before, after);
              await refreshAttachments();
            }}
            onDelete={async (restriction) => {
              await api.deleteRestriction(restriction);
              await refreshAttachments();
            }}
          />
          <TagsSection
            targetType="repository"
            targetId={targetId}
            tags={tags}
            tagLinks={tagLinks}
            onAddTag={api.addTag}
            onUpdateTag={api.updateTag}
            onDeleteTag={api.deleteTag}
            onAttachTag={async (link) => {
              await api.attachTag(link);
              await refreshAttachments();
            }}
            onDetachTag={async (link) => {
              await api.detachTag(link);
              await refreshAttachments();
            }}
          />
          <MediaSection
            targetType="repository"
            targetId={targetId}
            media={media.filter((item) =>
              item.links?.some((link) => link.targetType === 'repository' && link.targetId === targetId),
            )}
            api={mediaApi}
            refresh={async () => undefined}
            onOpenMedia={onOpenMedia}
          />
          <ContributorsSection
            targetType="repository"
            targetId={targetId}
            submitters={submitters}
            links={contributors}
            onAdd={api.addRecordSubmitter}
            onDelete={api.deleteRecordSubmitter}
          />
          <TasksSection targetType="repository" targetId={targetId} api={api} />
        </>
      )}
      {(!isNew || lastSaved !== undefined) && (
        <DangerZone>
          <Button
            variant="danger"
            size="sm"
            data-autosave-skip="true"
            onClick={() => {
              autoSave.cancel();
              void remove();
            }}
          >
            {nls.t('features.tree.fact.delete')}
          </Button>
        </DangerZone>
      )}
    </EntityTab>
  );
}

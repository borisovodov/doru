import { IconButton, useAutoFocusSelect } from '@doru/ui';
import { useMemo, useRef, useState } from 'react';
import { Input } from '@doru/ui';
import { SectionCard } from '@doru/ui';
import { Field, FieldGrid, InlineForm } from '@doru/ui';
import { Plus, User, X } from 'lucide-react';
import type { AddressRecord, RecordSubmitterLink, SourceRecord, SubmitterRecord } from '@doru/core';
import { MEDIA_VISIBLE } from '@doru/platform';
import { AttachmentsPanel, CitationAttachments, useAttachments } from '../attachments';
import { AutoSaveError } from '../autoSaveFeedback';
import { useEntityDelete } from '../entityDelete';
import { MediaSection } from '../media/MediaSection';
import { EntityTab } from '../sidebar';
import type { MediaTargetApi, RegistriesEditorApi } from '../person/types';
import type { MediaWithPath, TaskTargetData } from '@doru/ui/domain';
import {
  AddressLinkField,
  ContactsSection,
  ContributorsSection,
  NotesSection,
  SourcesSection,
  addressDraftEmpty,
  addressDraftMatches,
  addressLabel,
  taskTargetLabel,
} from '@doru/ui/domain';
import { nls } from '../nls';
import { Button, DangerZone, InlineError, useAutoSaveOnBlur } from '@doru/ui';
import { EntityCard, EntityViewCard } from '@doru/ui';
import { useRegistryAddress } from './useRegistryAddress';

/* oxlint-disable react/no-array-index-key -- lists without stable ids use their position as identity */

export function SubmitterTab({
  entityId,
  submitters,
  addresses,
  api,
  sources,
  media,
  mediaApi,
  recordSubmitters,
  targetData,
  onOpenSource,
  onOpenMedia,
  onOpenAddress,
  onOpenTarget,
  onClose,
  onCreated,
}: {
  entityId: string;
  submitters: SubmitterRecord[];
  addresses: AddressRecord[];
  api: RegistriesEditorApi;
  sources: SourceRecord[];
  media: MediaWithPath[];
  mediaApi: MediaTargetApi;
  recordSubmitters: RecordSubmitterLink[];
  targetData: TaskTargetData;
  onOpenSource: (sourceId: string) => void;
  onOpenMedia: (mediaId: string) => void;
  onOpenAddress: (addressId: string) => void;
  onOpenTarget: (targetType: string, targetId: string) => void;
  onClose: () => void;
  onCreated: (realId: string) => void;
}) {
  const submitterId = entityId;
  const isNew = submitterId.startsWith('new:');
  const record = submitters.find((submitter) => submitter.id === submitterId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tree.submitter.notFound')}</p>;
  }
  return (
    <SubmitterTabBody
      record={record}
      addresses={addresses}
      isNew={isNew}
      api={api}
      sources={sources}
      media={media}
      mediaApi={mediaApi}
      recordSubmitters={recordSubmitters}
      targetData={targetData}
      onOpenSource={onOpenSource}
      onOpenMedia={onOpenMedia}
      onOpenAddress={onOpenAddress}
      onOpenTarget={onOpenTarget}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function SubmitterTabBody({
  record,
  addresses,
  isNew,
  api,
  sources,
  media,
  mediaApi,
  recordSubmitters,
  targetData,
  onOpenSource,
  onOpenMedia,
  onOpenAddress,
  onOpenTarget,
  onClose,
  onCreated,
}: {
  record: SubmitterRecord | undefined;
  addresses: AddressRecord[];
  isNew: boolean;
  api: RegistriesEditorApi;
  sources: SourceRecord[];
  media: MediaWithPath[];
  mediaApi: MediaTargetApi;
  recordSubmitters: RecordSubmitterLink[];
  targetData: TaskTargetData;
  onOpenSource: (sourceId: string) => void;
  onOpenMedia: (mediaId: string) => void;
  onOpenAddress: (addressId: string) => void;
  onOpenTarget: (targetType: string, targetId: string) => void;
  onClose: () => void;
  onCreated: (realId: string) => void;
}) {
  const base: SubmitterRecord = record ?? { id: crypto.randomUUID(), name: '' };
  const nameRef = useAutoFocusSelect<HTMLInputElement>(isNew);
  const [lastSaved, setLastSaved] = useState<SubmitterRecord | undefined>(record);
  const [name, setName] = useState(isNew ? nls.t('features.tree.submitter.newSubmitter') : base.name);
  const [languages, setLanguages] = useState<string[]>([...(base.languages ?? [])]);
  const [linkedAddressId, setLinkedAddressId] = useState<string | undefined>(base.addressId);
  const { address, setAddress, addressBefore, addressSaveFailed, saveAddress, unlinkAddress, clearAddressSaveFailure } =
    useRegistryAddress(api, linkedAddressId);
  const addressText = addressBefore !== undefined ? addressLabel(addressBefore) : '';
  const targetId = (lastSaved ?? record)?.id;
  const {
    notes: submitterNotes,
    citations: submitterCitations,
    contacts,
    submitters: contributorOptions,
    contributors,
    refresh: refreshAttachments,
  } = useAttachments('submitter', targetId, api, true);

  const [saveError, setSaveError] = useState(false);
  const creatingRef = useRef(false);

  const selectAddress = (addressId: string | undefined) => {
    setSaveError(false);
    setLinkedAddressId(addressId);
    if (addressId === undefined) {
      unlinkAddress();
    }
  };

  const patchLanguage = (index: number, value: string) => {
    setSaveError(false);
    setLanguages(languages.map((language, i) => (i === index ? value : language)));
  };

  const save = async () => {
    const creating = isNew && lastSaved === undefined;
    if (creating) {
      if (creatingRef.current) {
        return;
      }
      creatingRef.current = true;
    }
    setSaveError(false);
    if (name.trim() === '') {
      if (creating) {
        creatingRef.current = false;
      }
      setSaveError(true);
      throw new Error('A submitter name is required.');
    }
    try {
      const next: SubmitterRecord = {
        id: base.id,
        xref: base.xref,
        name: name.trim(),
        languages: languages.map((language) => language.trim()).filter((language) => language !== ''),
      };
      if (linkedAddressId === undefined) {
        next.addressId = await saveAddress();
      } else {
        next.addressId = linkedAddressId;
      }
      if (creating) {
        await api.addSubmitter(next);
        onCreated(next.id);
      } else {
        await api.updateSubmitter(lastSaved ?? base, next);
      }
      clearAddressSaveFailure();
      setLastSaved(next);
    } catch (error) {
      setSaveError(true);
      throw error;
    } finally {
      if (creating) {
        creatingRef.current = false;
      }
    }
  };

  const persisted = lastSaved ?? record;
  const autoSave = useAutoSaveOnBlur({
    enabled: !isNew,
    isDirty: () => {
      if (persisted === undefined) {
        return false;
      }
      const currentLanguages = languages.map((language) => language.trim()).filter((language) => language !== '');
      const storedLanguages = persisted.languages ?? [];
      const addressDirty =
        linkedAddressId === undefined &&
        (addressBefore !== undefined ? !addressDraftMatches(address, addressBefore) : !addressDraftEmpty(address));
      const effectiveAddressId = linkedAddressId ?? addressBefore?.id;
      return (
        name.trim() !== persisted.name ||
        effectiveAddressId !== persisted.addressId ||
        addressDirty ||
        currentLanguages.length !== storedLanguages.length ||
        currentLanguages.some((language, index) => language !== storedLanguages[index])
      );
    },
    save,
  });

  const remove = async () => {
    const target = lastSaved ?? base;
    await api.deleteSubmitter(target);
  };

  const deletion = useEntityDelete(autoSave, remove, onClose);

  const referencedBy = useMemo(
    () => (targetId !== undefined ? recordSubmitters.filter((link) => link.submitterId === targetId) : []),
    [recordSubmitters, targetId],
  );
  const targetLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const link of referencedBy) {
      const key = `${link.targetType}:${link.targetId}`;
      if (!labels.has(key)) {
        labels.set(key, taskTargetLabel(link.targetType, link.targetId, targetData));
      }
    }
    return labels;
  }, [referencedBy, targetData]);
  const openableTarget = (targetType: string): boolean =>
    (MEDIA_VISIBLE || !targetType.startsWith('media')) &&
    ['person', 'family', 'source', 'place', 'repository', 'submitter', 'address', 'task', 'media', 'title'].includes(
      targetType,
    );

  return (
    <EntityTab onBlur={autoSave.onBlur}>
      <EntityViewCard
        media={<User size={20} aria-hidden="true" />}
        title={name.trim() || (isNew ? nls.t('features.tree.submitter.newSubmitter') : '—')}
        subtitle={addressText !== '' ? addressText : null}
        actions={
          isNew ? (
            <Button
              variant="primary"
              size="sm"
              data-autosave-skip="true"
              disabled={name.trim() === ''}
              onClick={() => void save().catch(() => undefined)}
            >
              {nls.t('features.tree.create')}
            </Button>
          ) : undefined
        }
      />
      <AutoSaveError failed={autoSave.failed} retryDisabled={autoSave.pendingDelete} onRetry={autoSave.retry} />
      {isNew && saveError ? <InlineError>{nls.t('features.tree.autosaveFailed')}</InlineError> : null}
      {deletion.failed ? <InlineError>{nls.t('features.tree.deleteFailed')}</InlineError> : null}

      <SectionCard title={nls.t('features.tree.details')}>
        <Field label={nls.t('features.tree.submitter.name')}>
          <Input
            ref={nameRef}
            value={name}
            onChange={(event) => {
              setSaveError(false);
              setName(event.target.value);
            }}
          />
        </Field>
        <FieldGrid columns={1}>
          {languages.map((language, index) => (
            <InlineForm key={index}>
              <Input
                placeholder={nls.t('features.tree.submitter.languages.field')}
                value={language}
                onChange={(event) => patchLanguage(index, event.target.value)}
              />
              <IconButton
                size="sm"
                label={nls.t('features.tree.submitter.languages.remove')}
                icon={<X size={13} aria-hidden="true" />}
                onClick={() => setLanguages(languages.filter((_, i) => i !== index))}
              />
            </InlineForm>
          ))}
        </FieldGrid>
        <Button variant="secondary" size="sm" onClick={() => setLanguages([...languages, ''])}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.submitter.languages.add')}
        </Button>
        <AddressLinkField
          addresses={addresses}
          addressId={linkedAddressId}
          address={address}
          onSelect={selectAddress}
          onChange={(next) => {
            setSaveError(false);
            setAddress(next);
          }}
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
          <SectionCard title={nls.t('features.tree.submitter.referencedBy')}>
            {referencedBy.length === 0 ? (
              <p className="side-registries-note">{nls.t('features.tree.submitter.referencedBy.empty')}</p>
            ) : (
              <ul className="side-section-list">
                {referencedBy.map((link) => (
                  <li key={link.id}>
                    <EntityCard
                      title={
                        targetLabels.get(`${link.targetType}:${link.targetId}`) ?? `${link.targetType}:${link.targetId}`
                      }
                      subtitle={
                        (link.kind ?? 'contributor') === 'contributor'
                          ? null
                          : nls.t(`features.tree.contributors.kind.${link.kind ?? 'contributor'}`)
                      }
                      {...(openableTarget(link.targetType)
                        ? { onClick: () => onOpenTarget(link.targetType, link.targetId) }
                        : {})}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SourcesSection
            targetType="submitter"
            targetId={targetId}
            sources={sources}
            citations={submitterCitations}
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
            notes={submitterNotes}
            onAdd={async (text) => {
              await api.addNote({ id: crypto.randomUUID(), text, targetType: 'submitter', targetId });
              await refreshAttachments();
            }}
            onUpdate={async (before, after) => {
              await api.updateNote(before, after);
              await refreshAttachments();
            }}
            onDelete={async (note) => {
              await api.deleteNote(note);
              await refreshAttachments();
            }}
          />
          <ContactsSection
            targetType="submitter"
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
          <MediaSection
            targetType="submitter"
            targetId={targetId}
            media={media.filter((item) =>
              item.links?.some((link) => link.targetType === 'submitter' && link.targetId === targetId),
            )}
            api={mediaApi}
            refresh={async () => undefined}
            onOpenMedia={onOpenMedia}
          />
          <ContributorsSection
            targetType="submitter"
            targetId={targetId}
            submitters={contributorOptions}
            links={contributors}
            onAdd={api.addRecordSubmitter}
            onDelete={api.deleteRecordSubmitter}
          />
        </>
      )}
      {(!isNew || lastSaved !== undefined) && (
        <DangerZone>
          <Button
            variant="danger"
            size="sm"
            data-autosave-skip="true"
            disabled={deletion.deleting}
            onClick={deletion.deleteEntity}
          >
            {nls.t('features.tree.fact.delete')}
          </Button>
        </DangerZone>
      )}
    </EntityTab>
  );
}

import { MapPin } from 'lucide-react';
import type { AddressRecord, FactRecord, RepositoryRecord, SourceRecord, SubmitterRecord } from '@doru/core';
import { AttachmentsPanel } from '../attachments';
import { AutoSaveError } from '../autoSaveFeedback';
import { useEntityDelete } from '../entityDelete';
import { EntityTab } from '../sidebar';
import type { RegistriesEditorApi } from '../person/types';
import {
  AddressFields,
  addressDraftEmpty,
  addressDraftMatches,
  addressDraftToRecord,
  addressLabel,
} from '@doru/ui/domain';
import { Button, DangerZone, EntityViewCard, InlineError, SectionCard, useAutoSaveOnBlur } from '@doru/ui';
import { nls } from '../nls';
import { useRegistryAddress } from './useRegistryAddress';

export function AddressTab({
  entityId,
  addresses,
  facts,
  repositories,
  submitters,
  sources,
  api,
  onClose,
  onOpenSource,
  onCreated,
}: {
  entityId: string;
  addresses: AddressRecord[];
  facts: FactRecord[];
  repositories: RepositoryRecord[];
  submitters: SubmitterRecord[];
  sources: SourceRecord[];
  api: RegistriesEditorApi;
  onClose: () => void;
  onOpenSource: (sourceId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const addressId = entityId;
  const isNew = addressId.startsWith('new:');
  const record = addresses.find((address) => address.id === addressId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tree.address.notFound')}</p>;
  }
  return (
    <AddressTabBody
      record={record}
      isNew={isNew}
      facts={facts}
      repositories={repositories}
      submitters={submitters}
      sources={sources}
      api={api}
      onClose={onClose}
      onOpenSource={onOpenSource}
      onCreated={onCreated}
    />
  );
}

function AddressTabBody({
  record,
  isNew,
  facts,
  repositories,
  submitters,
  sources,
  api,
  onClose,
  onOpenSource,
  onCreated,
}: {
  record: AddressRecord | undefined;
  isNew: boolean;
  facts: FactRecord[];
  repositories: RepositoryRecord[];
  submitters: SubmitterRecord[];
  sources: SourceRecord[];
  api: RegistriesEditorApi;
  onClose: () => void;
  onOpenSource: (sourceId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const base: AddressRecord = record ?? { id: crypto.randomUUID(), lines: [] };
  const { address, setAddress, addressLoaded, addressLoadFailed, addressSaveFailed, retryLoad, saveAddress } =
    useRegistryAddress(api, record?.id, isNew ? nls.t('features.tree.address.newAddress') : '');
  const preview = addressLabel(addressDraftToRecord(address));
  const usage = {
    facts: facts.filter((fact) => fact.addressId === base.id).length,
    repositories: repositories.filter((repository) => repository.addressId === base.id).length,
    submitters: submitters.filter((submitter) => submitter.addressId === base.id).length,
  };
  const usageCount = usage.facts + usage.repositories + usage.submitters;

  const save = async () => {
    if (!addressLoaded) {
      throw new Error('The address is still loading.');
    }
    if (addressDraftEmpty(address)) {
      throw new Error('An address must have at least one field.');
    }
    const id = await saveAddress();
    if (id === undefined) {
      return;
    }
    if (isNew && record === undefined) {
      onCreated(id);
    }
  };

  const autoSave = useAutoSaveOnBlur({
    enabled: !isNew,
    isDirty: () => addressLoaded && record !== undefined && !addressDraftMatches(address, record),
    save,
  });

  const remove = async () => {
    if (record !== undefined) {
      await api.deleteAddress(record);
    }
  };

  const deletion = useEntityDelete(autoSave, remove, onClose);

  return (
    <EntityTab onBlur={autoSave.onBlur}>
      <EntityViewCard
        media={<MapPin size={20} aria-hidden="true" />}
        title={preview || (isNew ? nls.t('features.tree.address.newAddress') : '—')}
        subtitle={usageCount > 0 ? nls.t('features.tree.address.usage', usageCount) : null}
        actions={
          isNew ? (
            <Button
              variant="primary"
              size="sm"
              data-autosave-skip="true"
              disabled={preview === ''}
              onClick={() => void save().catch(() => undefined)}
            >
              {nls.t('features.tree.create')}
            </Button>
          ) : undefined
        }
      />
      <AutoSaveError failed={autoSave.failed} retryDisabled={autoSave.pendingDelete} onRetry={autoSave.retry} />
      {deletion.failed ? <InlineError>{nls.t('features.tree.deleteFailed')}</InlineError> : null}
      <SectionCard title={nls.t('features.tree.address.title')}>
        {addressLoadFailed ? (
          <InlineError>
            {nls.t('features.tree.address.loadFailed')}{' '}
            <Button variant="link" size="sm" onClick={retryLoad}>
              {nls.t('features.tree.retry')}
            </Button>
          </InlineError>
        ) : null}
        {addressLoaded ? (
          <AddressFields
            address={address}
            autoFocus={isNew}
            onChange={setAddress}
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
        ) : null}
        {addressSaveFailed && (
          <p className="side-registries-note" role="alert">
            {nls.t('features.tree.address.saveFailed')}
          </p>
        )}
        {usageCount > 0 && (
          <p className="side-registries-note">{nls.t('features.tree.address.deleteWarning', usageCount)}</p>
        )}
      </SectionCard>
      {record !== undefined && (
        <AttachmentsPanel
          targetType="address"
          targetId={record.id}
          api={api}
          sources={sources}
          onOpenSource={onOpenSource}
        />
      )}
      {record !== undefined && (
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

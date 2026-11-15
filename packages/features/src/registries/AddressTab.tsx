import { MapPin } from 'lucide-react';
import type { AddressRecord, FactRecord, RepositoryRecord, SourceRecord, SubmitterRecord } from '@doru/core';
import { AttachmentsPanel } from '../attachments';
import { EntityTab } from '../sidebar';
import type { RegistriesEditorApi } from '../person/types';
import { AddressFields, addressDraftToRecord, addressLabel } from '@doru/ui/domain';
import { Button, EntityViewCard, SectionCard } from '@doru/ui';
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
  onCreated: (realId: string) => void;
}) {
  const base: AddressRecord = record ?? { id: crypto.randomUUID(), lines: [] };
  const { address, setAddress, saveAddress } = useRegistryAddress(api, record?.id);
  const preview = addressLabel(addressDraftToRecord(address));
  const usage = {
    facts: facts.filter((fact) => fact.addressId === base.id).length,
    repositories: repositories.filter((repository) => repository.addressId === base.id).length,
    submitters: submitters.filter((submitter) => submitter.addressId === base.id).length,
  };
  const usageCount = usage.facts + usage.repositories + usage.submitters;

  const save = async () => {
    const id = await saveAddress();
    if (id === undefined) {
      return;
    }
    if (isNew && record === undefined) {
      onCreated(id);
    }
  };

  const remove = async () => {
    if (record !== undefined) {
      await api.deleteAddress(record);
    }
    onClose();
  };

  return (
    <EntityTab>
      <EntityViewCard
        media={<MapPin size={20} aria-hidden="true" />}
        title={preview || '—'}
        subtitle={usageCount > 0 ? nls.t('features.tree.address.usage', usageCount) : null}
        actions={
          <>
            <Button variant="primary" size="sm" disabled={preview === ''} onClick={() => void save()}>
              {nls.t('features.tree.save')}
            </Button>
            {record !== undefined && (
              <Button variant="danger" size="sm" onClick={() => void remove()}>
                {nls.t('features.tree.fact.delete')}
              </Button>
            )}
          </>
        }
      />
      <SectionCard title={nls.t('features.tree.address.title')}>
        <AddressFields
          address={address}
          onChange={setAddress}
          renderAttachments={(lineId) => (
            <AttachmentsPanel targetType="address_line" targetId={lineId} api={api} sources={sources} />
          )}
        />
        {usageCount > 0 && (
          <p className="side-registries-note">{nls.t('features.tree.address.deleteWarning', usageCount)}</p>
        )}
      </SectionCard>
      {record !== undefined && (
        <AttachmentsPanel targetType="address" targetId={record.id} api={api} sources={sources} />
      )}
    </EntityTab>
  );
}

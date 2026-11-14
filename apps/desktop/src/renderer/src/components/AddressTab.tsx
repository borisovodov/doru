import { MapPin } from 'lucide-react';
import type { AddressRecord, FactRecord, RepositoryRecord, SourceRecord, SubmitterRecord } from '@doru/core';
import { AttachmentsPanel, EntityTab, type RegistriesEditorApi } from '@doru/features';
import { AddressFields, addressDraftToRecord, addressLabel } from '@doru/ui/domain';
import { Button, EntityViewCard, SectionCard } from '@doru/ui';
import { nls } from '@doru/workbench';
import { useRegistryAddress } from './useRegistryAddress';

export function AddressTab({
  tabId,
  addresses,
  facts,
  repositories,
  submitters,
  sources,
  api,
  onClose,
  onCreated,
}: {
  tabId: string;
  addresses: AddressRecord[];
  facts: FactRecord[];
  repositories: RepositoryRecord[];
  submitters: SubmitterRecord[];
  sources: SourceRecord[];
  api: RegistriesEditorApi;
  onClose: (tabId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const addressId = tabId.slice('address:'.length);
  const isNew = addressId.startsWith('new:');
  const record = addresses.find((address) => address.id === addressId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tree.address.notFound')}</p>;
  }
  return (
    <AddressTabBody
      tabId={tabId}
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
  tabId,
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
  tabId: string;
  record: AddressRecord | undefined;
  isNew: boolean;
  facts: FactRecord[];
  repositories: RepositoryRecord[];
  submitters: SubmitterRecord[];
  sources: SourceRecord[];
  api: RegistriesEditorApi;
  onClose: (tabId: string) => void;
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
    onClose(tabId);
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
        <AddressFields address={address} onChange={setAddress} />
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

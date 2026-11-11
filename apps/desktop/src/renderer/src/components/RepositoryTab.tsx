import { useEffect, useState } from 'react';
import { Archive } from 'lucide-react';
import type { RepositoryRecord } from '@doru/core';
import { AddressFields, EntityTab, addressLabel, type RegistriesEditorApi } from '@doru/features';
import { nls } from '@doru/workbench';
import { REPOSITORY_TAB_PREFIX } from '../hooks/useTabs';
import { useRegistryAddress } from './useRegistryAddress';

export function RepositoryTab({
  tabId,
  repositories,
  api,
  onClose,
}: {
  tabId: string;
  repositories: RepositoryRecord[];
  api: RegistriesEditorApi;
  onClose: (tabId: string) => void;
}) {
  const repositoryId = tabId.slice(REPOSITORY_TAB_PREFIX.length);
  const record = repositories.find((repository) => repository.id === repositoryId);
  if (!record) {
    return <p className="person-missing">{nls.t('features.tree.repository.notFound')}</p>;
  }
  return <RepositoryTabBody tabId={tabId} record={record} api={api} onClose={onClose} />;
}

function RepositoryTabBody({
  tabId,
  record,
  api,
  onClose,
}: {
  tabId: string;
  record: RepositoryRecord;
  api: RegistriesEditorApi;
  onClose: (tabId: string) => void;
}) {
  const [name, setName] = useState(record.name);
  const { address, setAddress, saveAddress } = useRegistryAddress(api, record.addressId);
  const [addressText, setAddressText] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (record.addressId !== undefined) {
      void api.getAddress(record.addressId).then((loaded) => {
        if (!cancelled && loaded) setAddressText(addressLabel(loaded));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [record.addressId, api]);

  const save = async () => {
    const next: RepositoryRecord = { id: record.id, xref: record.xref, name: name.trim() };
    next.addressId = await saveAddress();
    await api.updateRepository(record, next);
  };

  const remove = async () => {
    await api.deleteRepository(record);
    onClose(tabId);
  };

  return (
    <EntityTab>
      <div className="registry-editor">
        <section className="entity-view-card">
          <span className="entity-card-icon entity-view-icon">
            <Archive size={20} aria-hidden="true" />
          </span>
          <div className="entity-view-body">
            <h2 className="entity-view-title">{name.trim() || '—'}</h2>
            {addressText !== '' && <p className="entity-view-subtitle">{addressText}</p>}
          </div>
          <div className="person-view-actions">
            <button className="primary" onClick={() => void save()}>
              {nls.t('features.tree.save')}
            </button>
            <button className="registry-delete-button" onClick={() => void remove()}>
              {nls.t('features.tree.fact.delete')}
            </button>
          </div>
        </section>

        <section className="person-section">
          <h3>{nls.t('features.tree.details')}</h3>
          <label>
            {nls.t('features.tree.repository.name')}
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <AddressFields address={address} onChange={setAddress} />
        </section>
      </div>
    </EntityTab>
  );
}

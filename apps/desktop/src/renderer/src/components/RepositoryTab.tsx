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
  onCreated,
}: {
  tabId: string;
  repositories: RepositoryRecord[];
  api: RegistriesEditorApi;
  onClose: (tabId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const repositoryId = tabId.slice(REPOSITORY_TAB_PREFIX.length);
  const isNew = repositoryId.startsWith('new:');
  const record = repositories.find((repository) => repository.id === repositoryId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tree.repository.notFound')}</p>;
  }
  return <RepositoryTabBody tabId={tabId} record={record} isNew={isNew} api={api} onClose={onClose} onCreated={onCreated} />;
}

function RepositoryTabBody({
  tabId,
  record,
  isNew,
  api,
  onClose,
  onCreated,
}: {
  tabId: string;
  record: RepositoryRecord | undefined;
  isNew: boolean;
  api: RegistriesEditorApi;
  onClose: (tabId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const base: RepositoryRecord = record ?? { id: crypto.randomUUID(), name: '' };
  const [lastSaved, setLastSaved] = useState<RepositoryRecord | undefined>(record);
  const [name, setName] = useState(base.name);
  const { address, setAddress, saveAddress } = useRegistryAddress(api, base.addressId);
  const [addressText, setAddressText] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (base.addressId !== undefined) {
      void api.getAddress(base.addressId).then((loaded) => {
        if (!cancelled && loaded) setAddressText(addressLabel(loaded));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [base.addressId, api]);

  const save = async () => {
    const next: RepositoryRecord = { id: base.id, xref: base.xref, name: name.trim() };
    next.addressId = await saveAddress();
    if (isNew && lastSaved === undefined) {
      await api.addRepository(next);
      onCreated(next.id);
    } else {
      await api.updateRepository(lastSaved ?? base, next);
    }
    setLastSaved(next);
  };

  const remove = async () => {
    const target = lastSaved ?? base;
    await api.deleteRepository(target);
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
            <button className="primary" disabled={name.trim() === ''} onClick={() => void save()}>
              {nls.t('features.tree.save')}
            </button>
            {(!isNew || lastSaved !== undefined) && (
              <button className="registry-delete-button" onClick={() => void remove()}>
                {nls.t('features.tree.fact.delete')}
              </button>
            )}
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

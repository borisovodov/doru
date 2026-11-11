import { useEffect, useState } from 'react';
import { Plus, User, X } from 'lucide-react';
import type { SubmitterRecord } from '@doru/core';
import { AddressFields, EntityTab, addressLabel, type RegistriesEditorApi } from '@doru/features';
import { nls } from '@doru/workbench';
import { SUBMITTER_TAB_PREFIX } from '../hooks/useTabs';
import { useRegistryAddress } from './useRegistryAddress';

export function SubmitterTab({
  tabId,
  submitters,
  api,
  onClose,
}: {
  tabId: string;
  submitters: SubmitterRecord[];
  api: RegistriesEditorApi;
  onClose: (tabId: string) => void;
}) {
  const submitterId = tabId.slice(SUBMITTER_TAB_PREFIX.length);
  const record = submitters.find((submitter) => submitter.id === submitterId);
  if (!record) {
    return <p className="person-missing">{nls.t('features.tree.submitter.notFound')}</p>;
  }
  return <SubmitterTabBody tabId={tabId} record={record} api={api} onClose={onClose} />;
}

function SubmitterTabBody({
  tabId,
  record,
  api,
  onClose,
}: {
  tabId: string;
  record: SubmitterRecord;
  api: RegistriesEditorApi;
  onClose: (tabId: string) => void;
}) {
  const [name, setName] = useState(record.name);
  const [languages, setLanguages] = useState<string[]>([...(record.languages ?? [])]);
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

  const patchLanguage = (index: number, value: string) =>
    setLanguages(languages.map((language, i) => (i === index ? value : language)));

  const save = async () => {
    const next: SubmitterRecord = {
      id: record.id,
      xref: record.xref,
      name: name.trim(),
      languages: languages.map((language) => language.trim()).filter((language) => language !== ''),
    };
    next.addressId = await saveAddress();
    await api.updateSubmitter(record, next);
  };

  const remove = async () => {
    await api.deleteSubmitter(record);
    onClose(tabId);
  };

  return (
    <EntityTab>
      <div className="registry-editor">
        <section className="entity-view-card">
          <span className="entity-card-icon entity-view-icon">
            <User size={20} aria-hidden="true" />
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
            {nls.t('features.tree.submitter.name')}
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="registry-languages">
            {languages.map((language, index) => (
              <div className="registry-language-row" key={index}>
                <input
                  placeholder={nls.t('features.tree.submitter.languages.field')}
                  value={language}
                  onChange={(event) => patchLanguage(index, event.target.value)}
                />
                <button
                  className="icon-button"
                  title={nls.t('features.tree.submitter.languages.remove')}
                  onClick={() => setLanguages(languages.filter((_, i) => i !== index))}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
            ))}
            <button className="add-button small" onClick={() => setLanguages([...languages, ''])}>
              <Plus size={13} aria-hidden="true" />
              {nls.t('features.tree.submitter.languages.add')}
            </button>
          </div>
          <AddressFields address={address} onChange={setAddress} />
        </section>
      </div>
    </EntityTab>
  );
}

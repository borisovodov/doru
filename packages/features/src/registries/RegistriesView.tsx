import { useEffect, useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import type { AddressRecord, HeaderRecord, RepositoryRecord, SubmitterRecord } from '@doru/core';
import { nls } from '../nls';
import '../sidebar/sidebar.css';
import './RegistriesView.css';
import type { RegistriesEditorApi } from '../person/types';

/** An editable address of a registry entry: address lines plus the fixed fields. */
export interface AddressDraft {
  id: string | undefined; // undefined = no stored address yet
  lines: string[];
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export function emptyAddressDraft(): AddressDraft {
  return { id: undefined, lines: [''], city: '', state: '', postalCode: '', country: '' };
}

export function addressToDraft(address: AddressRecord): AddressDraft {
  return {
    id: address.id,
    lines: address.lines.length > 0 ? [...address.lines] : [''],
    city: address.city ?? '',
    state: address.state ?? '',
    postalCode: address.postalCode ?? '',
    country: address.country ?? '',
  };
}

export function addressDraftEmpty(draft: AddressDraft): boolean {
  return (
    draft.lines.every((line) => line.trim() === '') &&
    draft.city.trim() === '' &&
    draft.state.trim() === '' &&
    draft.postalCode.trim() === '' &&
    draft.country.trim() === ''
  );
}

export function addressDraftToRecord(draft: AddressDraft): AddressRecord {
  return {
    id: draft.id ?? crypto.randomUUID(),
    lines: draft.lines.map((line) => line.trim()).filter((line) => line !== ''),
    ...(draft.city.trim() !== '' ? { city: draft.city.trim() } : {}),
    ...(draft.state.trim() !== '' ? { state: draft.state.trim() } : {}),
    ...(draft.postalCode.trim() !== '' ? { postalCode: draft.postalCode.trim() } : {}),
    ...(draft.country.trim() !== '' ? { country: draft.country.trim() } : {}),
  };
}

/** The display form of an address: lines, then city/state/zip/country. */
export function addressLabel(address: AddressRecord | undefined): string {
  if (!address) {
    return '';
  }
  return [...address.lines, [address.city, address.state, address.postalCode].filter((part) => part !== undefined).join(' '), address.country]
    .filter((part) => part !== undefined && part !== '')
    .join(', ');
}

/**
 * The project registries: repositories and submitters with their
 * addresses, and the project header. Lives in the sidebar as the
 * Registries activity view (or, without `sidebar`, as a standalone view).
 */
export function RegistriesView({ api, sidebar = false }: { api: RegistriesEditorApi; sidebar?: boolean }) {
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [submitters, setSubmitters] = useState<SubmitterRecord[]>([]);
  const [header, setHeader] = useState<HeaderRecord>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all([api.getRepositories(), api.getSubmitters(), api.getHeader()]).then(
      ([loadedRepositories, loadedSubmitters, loadedHeader]) => {
        if (cancelled) {
          return;
        }
        setRepositories(loadedRepositories);
        setSubmitters(loadedSubmitters);
        setHeader(loadedHeader);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [api]);

  const refresh = async () => {
    const [loadedRepositories, loadedSubmitters, loadedHeader] = await Promise.all([
      api.getRepositories(),
      api.getSubmitters(),
      api.getHeader(),
    ]);
    setRepositories(loadedRepositories);
    setSubmitters(loadedSubmitters);
    setHeader(loadedHeader);
  };

  return (
    <div className={`registries-view${sidebar ? ' sidebar' : ''}`}>
      <section className="person-section">
        <h3>{nls.t('features.tree.registries.repositories')}</h3>
        {repositories.length === 0 && (
          <p className="notes-empty">{nls.t('features.tree.registries.repositories.empty')}</p>
        )}
        <ul className="registry-list">
          {repositories.map((repository) => (
            <li key={repository.id}>
              <RepositoryRow repository={repository} api={api} onChanged={() => void refresh()} />
            </li>
          ))}
        </ul>
        <button className="add-button" onClick={() => void addRepositoryAndRefresh(api, refresh)}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.registries.repositories.add')}
        </button>
      </section>

      <section className="person-section">
        <h3>{nls.t('features.tree.registries.submitters')}</h3>
        {submitters.length === 0 && (
          <p className="notes-empty">{nls.t('features.tree.registries.submitters.empty')}</p>
        )}
        <ul className="registry-list">
          {submitters.map((submitter) => (
            <li key={submitter.id}>
              <SubmitterRow submitter={submitter} api={api} onChanged={() => void refresh()} />
            </li>
          ))}
        </ul>
        <button className="add-button" onClick={() => void addSubmitterAndRefresh(api, refresh)}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.registries.submitters.add')}
        </button>
      </section>

      <section className="person-section">
        <h3>{nls.t('features.tree.registries.header')}</h3>
        <HeaderForm header={header} submitters={submitters} api={api} onSaved={() => void refresh()} />
      </section>
    </div>
  );
}

async function addRepositoryAndRefresh(api: RegistriesEditorApi, refresh: () => Promise<void>): Promise<void> {
  await api.addRepository({ id: crypto.randomUUID(), name: '' });
  await refresh();
}

async function addSubmitterAndRefresh(api: RegistriesEditorApi, refresh: () => Promise<void>): Promise<void> {
  await api.addSubmitter({ id: crypto.randomUUID(), name: '' });
  await refresh();
}

function RepositoryRow({
  repository,
  api,
  onChanged,
}: {
  repository: RepositoryRecord;
  api: RegistriesEditorApi;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(repository.name);
  const [address, setAddress] = useState<AddressDraft>(emptyAddressDraft());
  const [addressLoaded, setAddressLoaded] = useState(false);
  const [addressBefore, setAddressBefore] = useState<AddressRecord | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (repository.addressId !== undefined) {
      void api.getAddress(repository.addressId).then((loaded) => {
        if (!cancelled && loaded) {
          setAddress(addressToDraft(loaded));
          setAddressBefore(loaded);
          setAddressLoaded(true);
        }
      });
    } else {
      setAddressLoaded(true);
    }
    return () => {
      cancelled = true;
    };
  }, [repository.addressId, api]);

  if (!editing) {
    const addressText = repository.addressId !== undefined ? '' : '';
    return (
      <div className="registry-row">
        <span className="registry-name">{repository.name || '—'}</span>
        {addressText !== '' && <span className="registry-subtitle">{addressText}</span>}
        <button
          className="icon-button"
          title={nls.t('features.tree.registries.edit')}
          onClick={() => setEditing(true)}
        >
          <Pencil size={13} aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          title={nls.t('features.tree.registries.remove')}
          onClick={() => {
            void api.deleteRepository(repository);
            onChanged();
          }}
        >
          <X size={13} aria-hidden="true" />
        </button>
      </div>
    );
  }

  const save = async () => {
    const next: RepositoryRecord = { id: repository.id, xref: repository.xref, name: name.trim() };
    if (addressLoaded) {
      if (addressDraftEmpty(address)) {
        if (addressBefore) {
          await api.deleteAddress(addressBefore);
        }
      } else {
        const record = addressDraftToRecord(address);
        if (addressBefore) {
          await api.updateAddress(addressBefore, record);
        } else {
          await api.addAddress(record);
        }
        next.addressId = record.id;
      }
    }
    await api.updateRepository(repository, next);
    setEditing(false);
    onChanged();
  };

  return (
    <div className="registry-editor">
      <label>
        {nls.t('features.tree.registries.name')}
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      {addressLoaded && (
        <AddressFields address={address} onChange={setAddress} />
      )}
      <div className="registry-actions">
        <button className="add-button" disabled={name.trim() === ''} onClick={() => void save()}>
          {nls.t('features.tree.save')}
        </button>
        <button className="plain-button" onClick={() => setEditing(false)}>
          {nls.t('features.tree.fact.cancel')}
        </button>
      </div>
    </div>
  );
}

function SubmitterRow({
  submitter,
  api,
  onChanged,
}: {
  submitter: SubmitterRecord;
  api: RegistriesEditorApi;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(submitter.name);
  const [languages, setLanguages] = useState<string[]>([...(submitter.languages ?? [])]);
  const [address, setAddress] = useState<AddressDraft>(emptyAddressDraft());
  const [addressLoaded, setAddressLoaded] = useState(false);
  const [addressBefore, setAddressBefore] = useState<AddressRecord | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (submitter.addressId !== undefined) {
      void api.getAddress(submitter.addressId).then((loaded) => {
        if (!cancelled && loaded) {
          setAddress(addressToDraft(loaded));
          setAddressBefore(loaded);
          setAddressLoaded(true);
        }
      });
    } else {
      setAddressLoaded(true);
    }
    return () => {
      cancelled = true;
    };
  }, [submitter.addressId, api]);

  if (!editing) {
    return (
      <div className="registry-row">
        <span className="registry-name">{submitter.name || '—'}</span>
        <button
          className="icon-button"
          title={nls.t('features.tree.registries.edit')}
          onClick={() => setEditing(true)}
        >
          <Pencil size={13} aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          title={nls.t('features.tree.registries.remove')}
          onClick={() => {
            void api.deleteSubmitter(submitter);
            onChanged();
          }}
        >
          <X size={13} aria-hidden="true" />
        </button>
      </div>
    );
  }

  const patchLanguage = (index: number, value: string) =>
    setLanguages(languages.map((language, i) => (i === index ? value : language)));

  const save = async () => {
    const next: SubmitterRecord = {
      id: submitter.id,
      xref: submitter.xref,
      name: name.trim(),
      languages: languages.map((language) => language.trim()).filter((language) => language !== ''),
    };
    if (addressLoaded) {
      if (addressDraftEmpty(address)) {
        if (addressBefore) {
          await api.deleteAddress(addressBefore);
        }
      } else {
        const record = addressDraftToRecord(address);
        if (addressBefore) {
          await api.updateAddress(addressBefore, record);
        } else {
          await api.addAddress(record);
        }
        next.addressId = record.id;
      }
    }
    await api.updateSubmitter(submitter, next);
    setEditing(false);
    onChanged();
  };

  return (
    <div className="registry-editor">
      <label>
        {nls.t('features.tree.registries.name')}
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      {addressLoaded && <AddressFields address={address} onChange={setAddress} />}
      <div className="registry-languages">
        {languages.map((language, index) => (
          <div className="registry-language-row" key={index}>
            <input
              placeholder={nls.t('features.tree.registries.languages.field')}
              value={language}
              onChange={(event) => patchLanguage(index, event.target.value)}
            />
            <button
              className="icon-button"
              title={nls.t('features.tree.registries.languages.remove')}
              onClick={() => setLanguages(languages.filter((_, i) => i !== index))}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button className="add-button small" onClick={() => setLanguages([...languages, ''])}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.registries.languages.add')}
        </button>
      </div>
      <div className="registry-actions">
        <button className="add-button" disabled={name.trim() === ''} onClick={() => void save()}>
          {nls.t('features.tree.save')}
        </button>
        <button className="plain-button" onClick={() => setEditing(false)}>
          {nls.t('features.tree.fact.cancel')}
        </button>
      </div>
    </div>
  );
}

function AddressFields({ address, onChange }: { address: AddressDraft; onChange: (draft: AddressDraft) => void }) {
  const set = (patch: Partial<AddressDraft>) => onChange({ ...address, ...patch });
  const patchLine = (index: number, value: string) =>
    set({ lines: address.lines.map((line, i) => (i === index ? value : line)) });

  return (
    <div className="registry-address">
      <h4>{nls.t('features.tree.registries.address')}</h4>
      {address.lines.map((line, index) => (
        <input
          key={index}
          placeholder={nls.t('features.tree.registries.address.line')}
          value={line}
          onChange={(event) => patchLine(index, event.target.value)}
        />
      ))}
      <button
        className="add-button small"
        onClick={() => set({ lines: [...address.lines, ''] })}
      >
        <Plus size={13} aria-hidden="true" />
        {nls.t('features.tree.registries.address.addLine')}
      </button>
      <div className="registry-address-grid">
        <input
          placeholder={nls.t('features.tree.registries.address.city')}
          value={address.city}
          onChange={(event) => set({ city: event.target.value })}
        />
        <input
          placeholder={nls.t('features.tree.registries.address.state')}
          value={address.state}
          onChange={(event) => set({ state: event.target.value })}
        />
        <input
          placeholder={nls.t('features.tree.registries.address.postalCode')}
          value={address.postalCode}
          onChange={(event) => set({ postalCode: event.target.value })}
        />
        <input
          placeholder={nls.t('features.tree.registries.address.country')}
          value={address.country}
          onChange={(event) => set({ country: event.target.value })}
        />
      </div>
    </div>
  );
}

function HeaderForm({
  header,
  submitters,
  api,
  onSaved,
}: {
  header: HeaderRecord;
  submitters: SubmitterRecord[];
  api: RegistriesEditorApi;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<HeaderRecord>(header);

  useEffect(() => {
    setDraft(header);
  }, [header]);

  const set = (patch: Partial<HeaderRecord>) => setDraft({ ...draft, ...patch });

  const save = async () => {
    await api.saveHeader(draft);
    onSaved();
  };

  return (
    <div className="header-form">
      {header.gedcomVersion !== undefined && (
        <p className="registry-meta">
          {nls.t('features.tree.registries.header.gedcomVersion')}: {header.gedcomVersion}
        </p>
      )}
      {header.fileName !== undefined && (
        <p className="registry-meta">
          {nls.t('features.tree.registries.header.fileName')}: {header.fileName}
        </p>
      )}
      <div className="registry-address-grid">
        <input
          placeholder={nls.t('features.tree.registries.header.language')}
          value={draft.language ?? ''}
          onChange={(event) => set({ language: event.target.value || undefined })}
        />
        <input
          placeholder={nls.t('features.tree.registries.header.placeForm')}
          value={draft.placeForm ?? ''}
          onChange={(event) => set({ placeForm: event.target.value || undefined })}
        />
        <input
          placeholder={nls.t('features.tree.registries.header.sourceName')}
          value={draft.sourceName ?? ''}
          onChange={(event) => set({ sourceName: event.target.value || undefined })}
        />
        <input
          placeholder={nls.t('features.tree.registries.header.sourceSoftware')}
          value={draft.sourceSoftware ?? ''}
          onChange={(event) => set({ sourceSoftware: event.target.value || undefined })}
        />
        <input
          placeholder={nls.t('features.tree.registries.header.sourceVersion')}
          value={draft.sourceVersion ?? ''}
          onChange={(event) => set({ sourceVersion: event.target.value || undefined })}
        />
        <input
          placeholder={nls.t('features.tree.registries.header.familyFile')}
          value={draft.familyFile ?? ''}
          onChange={(event) => set({ familyFile: event.target.value || undefined })}
        />
        <input
          placeholder={nls.t('features.tree.registries.header.temple')}
          value={draft.temple ?? ''}
          onChange={(event) => set({ temple: event.target.value || undefined })}
        />
      </div>
      <div className="registry-address-grid">
        <input
          placeholder={nls.t('features.tree.registries.header.copyright')}
          value={draft.copyright ?? ''}
          onChange={(event) => set({ copyright: event.target.value || undefined })}
        />
        <label className="registry-inline-label">
          {nls.t('features.tree.registries.header.submitter')}
          <select
            value={draft.submitterId ?? ''}
            onChange={(event) => set({ submitterId: event.target.value || undefined })}
          >
            <option value="">{nls.t('features.tree.registries.header.submitter.none')}</option>
            {submitters.map((submitter) => (
              <option key={submitter.id} value={submitter.id}>
                {submitter.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="registry-address-grid">
        <label className="registry-inline-label">
          {nls.t('features.tree.registries.header.generationsAncestors')}
          <input
            type="number"
            min={0}
            value={draft.generationsAncestors ?? ''}
            onChange={(event) =>
              set({ generationsAncestors: event.target.value === '' ? undefined : Number(event.target.value) })
            }
          />
        </label>
        <label className="registry-inline-label">
          {nls.t('features.tree.registries.header.generationsDescendants')}
          <input
            type="number"
            min={0}
            value={draft.generationsDescendants ?? ''}
            onChange={(event) =>
              set({ generationsDescendants: event.target.value === '' ? undefined : Number(event.target.value) })
            }
          />
        </label>
      </div>
      <div className="registry-actions">
        <button className="add-button" onClick={() => void save()}>
          {nls.t('features.tree.save')}
        </button>
      </div>
    </div>
  );
}

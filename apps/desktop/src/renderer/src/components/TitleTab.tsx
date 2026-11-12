import { useState } from 'react';
import { BookMarked } from 'lucide-react';
import type { RepositoryRecord, SourceRecord, TitleRecord } from '@doru/core';
import { EntityTab } from '@doru/features';
import { nls } from '@doru/workbench';
import { Button, EntityViewCard } from '@doru/ui';
import { TITLE_TAB_PREFIX } from '../hooks/useTabs';

export function TitleTab({
  tabId,
  titles,
  sources,
  repositories,
  api,
  onClose,
  onOpenSource,
  onCreated,
}: {
  tabId: string;
  titles: TitleRecord[];
  sources: SourceRecord[];
  repositories: RepositoryRecord[];
  api: {
    addTitle: (title: TitleRecord) => Promise<void>;
    updateTitle: (before: TitleRecord, after: TitleRecord) => Promise<void>;
    deleteTitle: (title: TitleRecord) => Promise<void>;
  };
  onClose: (tabId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const titleId = tabId.slice(TITLE_TAB_PREFIX.length);
  const isNew = titleId.startsWith('new:');
  const record = titles.find((title) => title.id === titleId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tree.title.notFound')}</p>;
  }
  return (
    <TitleTabBody
      tabId={tabId}
      record={record}
      isNew={isNew}
      sources={sources}
      repositories={repositories}
      api={api}
      onClose={onClose}
      onOpenSource={onOpenSource}
      onCreated={onCreated}
    />
  );
}

function TitleTabBody({
  tabId,
  record,
  isNew,
  sources,
  repositories,
  api,
  onClose,
  onOpenSource,
  onCreated,
}: {
  tabId: string;
  record: TitleRecord | undefined;
  isNew: boolean;
  sources: SourceRecord[];
  repositories: RepositoryRecord[];
  api: {
    addTitle: (title: TitleRecord) => Promise<void>;
    updateTitle: (before: TitleRecord, after: TitleRecord) => Promise<void>;
    deleteTitle: (title: TitleRecord) => Promise<void>;
  };
  onClose: (tabId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const base = record ?? { id: crypto.randomUUID() };
  const [lastSaved, setLastSaved] = useState<TitleRecord | undefined>(record);
  const [name, setName] = useState(base.name ?? '');
  const [author, setAuthor] = useState(base.author ?? '');
  const [publisher, setPublisher] = useState(base.publisher ?? '');
  const [series, setSeries] = useState(base.series ?? '');
  const [abbreviation, setAbbreviation] = useState(base.abbreviation ?? '');
  const [callNumber, setCallNumber] = useState(base.callNumber ?? '');
  const [sequence, setSequence] = useState(base.sequence !== undefined ? String(base.sequence) : '');
  const [repositoryId, setRepositoryId] = useState(base.repositoryId ?? '');

  const citingSources = isNew ? [] : sources.filter((source) => source.titleId === base.id);

  const subtitle = [author.trim(), publisher.trim()].filter((part) => part !== '').join(' · ');

  const build = (): TitleRecord => ({
    id: base.id,
    xref: base.xref,
    name: name.trim() || undefined,
    author: author.trim() || undefined,
    publisher: publisher.trim() || undefined,
    series: series.trim() || undefined,
    abbreviation: abbreviation.trim() || undefined,
    callNumber: callNumber.trim() || undefined,
    sequence: sequence.trim() === '' ? undefined : Number(sequence),
    repositoryId: repositoryId === '' ? undefined : repositoryId,
  });

  const save = async () => {
    if (name.trim() === '') {
      return;
    }
    const after = build();
    if (isNew && lastSaved === undefined) {
      await api.addTitle(after);
      onCreated(after.id);
    } else {
      await api.updateTitle(lastSaved ?? base, after);
    }
    setLastSaved(after);
  };

  const remove = async () => {
    const target = lastSaved ?? base;
    await api.deleteTitle(target);
    onClose(tabId);
  };

  return (
    <EntityTab>
      <div className="registry-editor">
        <EntityViewCard
          media={<BookMarked size={20} aria-hidden="true" />}
          title={name.trim() || '—'}
          subtitle={subtitle !== '' ? subtitle : null}
          actions={
            <>
              <Button variant="primary" size="sm" disabled={name.trim() === ''} onClick={() => void save()}>
                {nls.t('features.tree.save')}
              </Button>
              {(!isNew || lastSaved !== undefined) && (
                <Button variant="danger" size="sm" onClick={() => void remove()}>
                  {nls.t('features.tree.fact.delete')}
                </Button>
              )}
            </>
          }
        />

        <section className="person-section">
          <h3>{nls.t('features.tree.details')}</h3>
          <label>
            {nls.t('features.tree.title.name')}
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="registry-grid">
            <label>
              {nls.t('features.tree.title.author')}
              <input value={author} onChange={(event) => setAuthor(event.target.value)} />
            </label>
            <label>
              {nls.t('features.tree.title.publisher')}
              <input value={publisher} onChange={(event) => setPublisher(event.target.value)} />
            </label>
            <label>
              {nls.t('features.tree.title.series')}
              <input value={series} onChange={(event) => setSeries(event.target.value)} />
            </label>
            <label>
              {nls.t('features.tree.title.abbreviation')}
              <input value={abbreviation} onChange={(event) => setAbbreviation(event.target.value)} />
            </label>
            <label>
              {nls.t('features.tree.title.callNumber')}
              <input value={callNumber} onChange={(event) => setCallNumber(event.target.value)} />
            </label>
            <label>
              {nls.t('features.tree.title.sequence')}
              <input type="number" value={sequence} onChange={(event) => setSequence(event.target.value)} />
            </label>
          </div>
          <label>
            {nls.t('features.tree.title.repository')}
            <select value={repositoryId} onChange={(event) => setRepositoryId(event.target.value)}>
              <option value="">{nls.t('features.tree.title.none')}</option>
              {repositories.map((repository) => (
                <option key={repository.id} value={repository.id}>
                  {repository.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        {!isNew && (
          <section className="person-section">
            <h3>{nls.t('features.tree.title.sources')}</h3>
            {citingSources.length === 0 ? (
              <p className="notes-empty">{nls.t('features.tree.title.sourcesEmpty')}</p>
            ) : (
              <ul className="side-section-list">
                {citingSources.map((source) => (
                  <li key={source.id} className="entity-card clickable" onClick={() => onOpenSource(source.id)}>
                    <span className="entity-card-body">
                      <span className="entity-card-title">{source.title || '—'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </EntityTab>
  );
}

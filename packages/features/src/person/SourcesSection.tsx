import { useState } from 'react';
import { X } from 'lucide-react';
import type { SourceRecord } from '@doru/core';
import { nls } from '../nls';
import type { CitationInfo } from './types';
import './SourcesSection.css';

interface SourcesSectionProps {
  personId: string;
  sources: SourceRecord[];
  citations: CitationInfo[];
  refresh: () => Promise<void>;
  onAddSource: (source: SourceRecord, targetId: string) => Promise<void>;
  onAttachSource: (sourceId: string, targetId: string) => Promise<void>;
  onDetachCitation: (citationId: string) => Promise<void>;
}

export function SourcesSection({
  personId,
  sources,
  citations,
  refresh,
  onAddSource,
  onAttachSource,
  onDetachCitation,
}: SourcesSectionProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');

  const addNew = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }
    await onAddSource({ id: crypto.randomUUID(), title: trimmed, author: author.trim() || undefined }, personId);
    setTitle('');
    setAuthor('');
    await refresh();
  };

  const detach = async (citationId: string) => {
    await onDetachCitation(citationId);
    await refresh();
  };

  const attach = async (sourceId: string) => {
    await onAttachSource(sourceId, personId);
    await refresh();
  };

  const citedIds = new Set(citations.map((citation) => citation.source.id));
  const uncited = sources.filter((source) => !citedIds.has(source.id));

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.sources.title')}</h3>
      {citations.length === 0 && (
        <p className="notes-empty">{nls.t('features.tree.sources.empty')}</p>
      )}
      <ul className="source-list">
        {citations.map((citation) => (
          <li key={citation.id}>
            <span>{citation.source.title}</span>
            <button title={nls.t('features.tree.sources.detach')} onClick={() => void detach(citation.id)}>
              <X size={12} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <div className="sources-new">
        <input
          placeholder={nls.t('features.tree.sources.titleField')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <input
          placeholder={nls.t('features.tree.sources.authorField')}
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
        />
        <button onClick={() => void addNew()}>{nls.t('features.tree.sources.add')}</button>
      </div>
      {uncited.length > 0 && (
        <div className="sources-attach">
          {uncited.map((source) => (
            <button key={source.id} title={source.title} onClick={() => void attach(source.id)}>
              {nls.t('features.tree.sources.attach')}: {source.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

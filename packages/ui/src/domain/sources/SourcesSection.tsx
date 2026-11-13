import { Button } from '../../atoms/button/Button';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Input } from '../../atoms/form/Input';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import { SourceLink } from './SourceLink';
import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import type { CitationRecord, SourceRecord } from '@doru/core';
import { nls } from '../../nls';
import { CitationEditor } from '../citation/CitationEditor';
import './SourcesSection.css';

interface SourcesSectionProps {
  targetType: string;
  targetId: string;
  sources: SourceRecord[];
  citations: CitationRecord[];
  refresh: () => Promise<void>;
  onAddSource: (source: SourceRecord, targetType: string, targetId: string) => Promise<void>;
  onAttachSource: (sourceId: string, targetType: string, targetId: string) => Promise<void>;
  onDetachCitation: (citationId: string) => Promise<void>;
  onUpdateCitation: (before: CitationRecord, after: CitationRecord) => Promise<void>;
  onOpenSource: (sourceId: string) => void;
}

export function SourcesSection({
  targetType,
  targetId,
  sources,
  citations,
  refresh,
  onAddSource,
  onAttachSource,
  onDetachCitation,
  onUpdateCitation,
  onOpenSource,
}: SourcesSectionProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addNew = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }
    await onAddSource(
      { id: crypto.randomUUID(), title: trimmed, author: author.trim() || undefined },
      targetType,
      targetId,
    );
    setTitle('');
    setAuthor('');
    await refresh();
  };

  const detach = async (citationId: string) => {
    await onDetachCitation(citationId);
    if (expandedId === citationId) {
      setExpandedId(null);
    }
    await refresh();
  };

  const attach = async (sourceId: string) => {
    await onAttachSource(sourceId, targetType, targetId);
    await refresh();
  };

  const saveCitation = async (before: CitationRecord, after: CitationRecord) => {
    await onUpdateCitation(before, after);
    setExpandedId(null);
    await refresh();
  };

  const citedIds = new Set(citations.map((citation) => citation.sourceId));
  const uncited = sources.filter((source) => !citedIds.has(source.id));
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return (
    <SectionCard title={nls.t('features.tree.sources.title')}>
      {citations.length === 0 && <EmptyText>{nls.t('features.tree.sources.empty')}</EmptyText>}
      <ul className="source-list">
        {citations.map((citation) => (
          <li key={citation.id}>
            <div className="source-row">
              <SourceLink
                title={sourceById.get(citation.sourceId)?.title ?? citation.sourceId}
                onClick={() => onOpenSource(citation.sourceId)}
              />
              <IconButton
                size="sm"
                label={nls.t('features.tree.citation.edit')}
                icon={<Pencil size={13} aria-hidden="true" />}
                onClick={() => setExpandedId(expandedId === citation.id ? null : citation.id)}
              />
              <IconButton
                size="sm"
                label={nls.t('features.tree.sources.detach')}
                icon={<X size={13} aria-hidden="true" />}
                onClick={() => void detach(citation.id)}
              />
            </div>
            {expandedId === citation.id && (
              <CitationEditor
                citation={citation}
                onSave={(after) => saveCitation(citation, after)}
                onCancel={() => setExpandedId(null)}
              />
            )}
          </li>
        ))}
      </ul>
      <div className="sources-new">
        <Input
          placeholder={nls.t('features.tree.sources.titleField')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Input
          placeholder={nls.t('features.tree.sources.authorField')}
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
        />
        <Button variant="primary" onClick={() => void addNew()}>
          {nls.t('features.tree.sources.add')}
        </Button>
      </div>
      {uncited.length > 0 && (
        <div className="sources-attach">
          {uncited.map((source) => (
            <Button
              key={source.id}
              size="sm"
              variant="secondary"
              title={source.title}
              onClick={() => void attach(source.id)}
            >
              {nls.t('features.tree.sources.attach')}: {source.title}
            </Button>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

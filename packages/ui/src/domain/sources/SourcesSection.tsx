import { Button } from '../../atoms/button/Button';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Input } from '../../atoms/form/Input';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import { SourceLink } from './SourceLink';
import { useState, type ReactNode } from 'react';
import { Pencil, X } from 'lucide-react';
import type { CitationRecord, SourceRecord, TargetRef } from '@doru/core';
import { TARGET_TYPES } from '@doru/core/model';
import { nls } from '../../nls';
import { CitationEditor } from '../citation/CitationEditor';
import { TargetPicker } from '../targets';
import './SourcesSection.css';

const CITATION_TARGET_TYPES = TARGET_TYPES.filter((type) => type !== 'task');

interface SourcesSectionProps {
  sectionTitle?: string | undefined;
  targetType: string;
  targetId: string;
  sources: SourceRecord[];
  citations: CitationRecord[];
  refresh: () => Promise<void>;
  onAddSource: (source: SourceRecord, targetType: string, targetId: string) => Promise<void>;
  onAddSourceToTargets?: ((source: SourceRecord, targets: TargetRef[]) => Promise<void>) | undefined;
  onAttachSource: (sourceId: string, targetType: string, targetId: string) => Promise<void>;
  onAttachSourceToTargets?: ((sourceId: string, targets: TargetRef[]) => Promise<void>) | undefined;
  onDetachCitation: (citationId: string) => Promise<void>;
  onUpdateCitation: (before: CitationRecord, after: CitationRecord) => Promise<void>;
  onOpenSource: (sourceId: string) => void;
  renderCitationAttachments?: ((citation: CitationRecord) => ReactNode) | undefined;
}

export function SourcesSection({
  sectionTitle,
  targetType,
  targetId,
  sources,
  citations,
  refresh,
  onAddSource,
  onAddSourceToTargets,
  onAttachSource,
  onAttachSourceToTargets,
  onDetachCitation,
  onUpdateCitation,
  onOpenSource,
  renderCitationAttachments,
}: SourcesSectionProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [extraTargets, setExtraTargets] = useState<TargetRef[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addNew = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }
    const source = { id: crypto.randomUUID(), title: trimmed, author: author.trim() || undefined };
    if (onAddSourceToTargets !== undefined) {
      await onAddSourceToTargets(source, [{ targetType, targetId }, ...extraTargets]);
    } else {
      await onAddSource(source, targetType, targetId);
    }
    setTitle('');
    setAuthor('');
    setExtraTargets([]);
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
    if (onAttachSourceToTargets !== undefined) {
      await onAttachSourceToTargets(sourceId, [{ targetType, targetId }, ...extraTargets]);
    } else {
      await onAttachSource(sourceId, targetType, targetId);
    }
    setExtraTargets([]);
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
    <SectionCard title={sectionTitle ?? nls.t('features.tree.sources.title')}>
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
                attachments={renderCitationAttachments?.(citation)}
                onSave={(after) => saveCitation(citation, after)}
                onDelete={async () => {
                  await onDetachCitation(citation.id);
                  setExpandedId(null);
                }}
                onCancel={() => setExpandedId(null)}
              />
            )}
          </li>
        ))}
      </ul>
      {(onAddSourceToTargets !== undefined || onAttachSourceToTargets !== undefined) && (
        <TargetPicker
          allowedTypes={CITATION_TARGET_TYPES}
          value={extraTargets}
          onChange={setExtraTargets}
          ariaLabel={nls.t('features.tasks.target')}
        />
      )}
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

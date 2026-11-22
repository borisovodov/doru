import { useState } from 'react';
import { EmptyText, useAutoFocusSelect } from '@doru/ui';
import { Input } from '@doru/ui';
import { Select } from '@doru/ui';
import { SectionCard } from '@doru/ui';
import { Field, FieldGrid } from '@doru/ui';
import { AttachmentRow, RowList } from '@doru/ui';
import { BookMarked } from 'lucide-react';
import type { RepositoryRecord, SourceRecord, TitleRecord } from '@doru/core';
import { AttachmentsPanel } from '../attachments';
import { AutoSaveError } from '../autoSaveFeedback';
import { EntityTab } from '../sidebar';
import type { TitleEditorApi } from '../person/types';
import { nls } from '../nls';
import { Button, DangerZone, useAutoSaveOnBlur } from '@doru/ui';
import { EntityViewCard } from '@doru/ui';

export function TitleTab({
  entityId,
  titles,
  sources,
  repositories,
  api,
  onClose,
  onOpenSource,
  onOpenMedia,
  onCreated,
}: {
  entityId: string;
  titles: TitleRecord[];
  sources: SourceRecord[];
  repositories: RepositoryRecord[];
  api: TitleEditorApi;
  onClose: () => void;
  onOpenMedia: (mediaId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const titleId = entityId;
  const isNew = titleId.startsWith('new:');
  const record = titles.find((title) => title.id === titleId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tree.title.notFound')}</p>;
  }
  return (
    <TitleTabBody
      record={record}
      isNew={isNew}
      sources={sources}
      repositories={repositories}
      api={api}
      onClose={onClose}
      onOpenSource={onOpenSource}
      onOpenMedia={onOpenMedia}
      onCreated={onCreated}
    />
  );
}

function TitleTabBody({
  record,
  isNew,
  sources,
  repositories,
  api,
  onClose,
  onOpenSource,
  onOpenMedia,
  onCreated,
}: {
  record: TitleRecord | undefined;
  isNew: boolean;
  sources: SourceRecord[];
  repositories: RepositoryRecord[];
  api: TitleEditorApi;
  onClose: () => void;
  onOpenSource: (sourceId: string) => void;
  onOpenMedia: (mediaId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const base = record ?? { id: crypto.randomUUID() };
  const nameRef = useAutoFocusSelect<HTMLInputElement>(isNew);
  const [lastSaved, setLastSaved] = useState<TitleRecord | undefined>(record);
  const [name, setName] = useState(isNew ? nls.t('features.tree.title.newTitle') : (base.name ?? ''));
  const [author, setAuthor] = useState(base.author ?? '');
  const [publisher, setPublisher] = useState(base.publisher ?? '');
  const [series, setSeries] = useState(base.series ?? '');
  const [abbreviation, setAbbreviation] = useState(base.abbreviation ?? '');
  const [callNumber, setCallNumber] = useState(base.callNumber ?? '');
  const [sequence, setSequence] = useState(base.sequence !== undefined ? String(base.sequence) : '');
  const [repositoryId, setRepositoryId] = useState(base.repositoryId ?? '');

  const citingSources = isNew ? [] : sources.filter((source) => source.titleId === base.id);
  const targetId = lastSaved?.id ?? record?.id;

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
    const after = build();
    if (isNew && lastSaved === undefined) {
      await api.addTitle(after);
      onCreated(after.id);
    } else {
      await api.updateTitle(lastSaved ?? base, after);
    }
    setLastSaved(after);
  };

  const persisted = lastSaved ?? record;
  const autoSave = useAutoSaveOnBlur({
    enabled: !isNew,
    isDirty: () => persisted !== undefined && JSON.stringify(build()) !== JSON.stringify(persisted),
    save,
  });

  const remove = async () => {
    const target = lastSaved ?? base;
    await api.deleteTitle(target);
    autoSave.release();
    onClose();
  };

  return (
    <EntityTab onBlur={autoSave.onBlur}>
      <EntityViewCard
        media={<BookMarked size={20} aria-hidden="true" />}
        title={name.trim() || (isNew ? nls.t('features.tree.title.newTitle') : '—')}
        subtitle={subtitle !== '' ? subtitle : null}
        actions={
          isNew ? (
            <Button variant="primary" size="sm" data-autosave-skip="true" onClick={() => void save()}>
              {nls.t('features.tree.create')}
            </Button>
          ) : undefined
        }
      />
      <AutoSaveError failed={autoSave.failed} onRetry={autoSave.retry} />

      <SectionCard title={nls.t('features.tree.details')}>
        <Field label={nls.t('features.tree.title.name')}>
          <Input ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <FieldGrid columns={2}>
          <Field label={nls.t('features.tree.title.author')}>
            <Input value={author} onChange={(event) => setAuthor(event.target.value)} />
          </Field>
          <Field label={nls.t('features.tree.title.publisher')}>
            <Input value={publisher} onChange={(event) => setPublisher(event.target.value)} />
          </Field>
          <Field label={nls.t('features.tree.title.series')}>
            <Input value={series} onChange={(event) => setSeries(event.target.value)} />
          </Field>
          <Field label={nls.t('features.tree.title.abbreviation')}>
            <Input value={abbreviation} onChange={(event) => setAbbreviation(event.target.value)} />
          </Field>
          <Field label={nls.t('features.tree.title.callNumber')}>
            <Input value={callNumber} onChange={(event) => setCallNumber(event.target.value)} />
          </Field>
          <Field label={nls.t('features.tree.title.sequence')}>
            <Input type="number" value={sequence} onChange={(event) => setSequence(event.target.value)} />
          </Field>
        </FieldGrid>
        <Field label={nls.t('features.tree.title.repository')}>
          <Select value={repositoryId} onChange={(event) => setRepositoryId(event.target.value)}>
            <option value="">{nls.t('features.tree.title.none')}</option>
            {repositories.map((repository) => (
              <option key={repository.id} value={repository.id}>
                {repository.name}
              </option>
            ))}
          </Select>
        </Field>
      </SectionCard>

      {!isNew && (
        <SectionCard title={nls.t('features.tree.title.sources')}>
          {citingSources.length === 0 ? (
            <EmptyText>{nls.t('features.tree.title.sourcesEmpty')}</EmptyText>
          ) : (
            <RowList>
              {citingSources.map((source) => (
                <AttachmentRow
                  key={source.id}
                  value={
                    <Button variant="link" onClick={() => onOpenSource(source.id)}>
                      {source.title || '—'}
                    </Button>
                  }
                />
              ))}
            </RowList>
          )}
        </SectionCard>
      )}
      {targetId !== undefined && (
        <AttachmentsPanel
          targetType="title"
          targetId={targetId}
          api={api}
          sources={sources}
          onOpenSource={onOpenSource}
          onOpenMedia={onOpenMedia}
        />
      )}
      {(!isNew || lastSaved !== undefined) && (
        <DangerZone>
          <Button
            variant="danger"
            size="sm"
            data-autosave-skip="true"
            onClick={() => {
              autoSave.cancel();
              void remove().catch(() => autoSave.resume());
            }}
          >
            {nls.t('features.tree.fact.delete')}
          </Button>
        </DangerZone>
      )}
    </EntityTab>
  );
}

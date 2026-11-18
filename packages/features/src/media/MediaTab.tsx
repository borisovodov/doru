import { useEffect, useRef, useState } from 'react';
import { FileImage, Image as ImageIcon, Paperclip, X } from 'lucide-react';
import { isImagePath, type MediaFile, type MediaLinkRecord, type MediaRecord, type SourceRecord } from '@doru/core';
import { placeName } from '@doru/core/model';
import {
  Button,
  Checkbox,
  EntityViewCard,
  Field,
  FieldGrid,
  IconButton,
  Input,
  MetadataText,
  ReorderButtons,
  SectionCard,
  Select,
  Textarea,
} from '@doru/ui';
import { DateEditor, dateDraftsEqual, fromDateDraft, toDateDraft } from '@doru/ui/domain';
import { AttachmentsPanel } from '../attachments';
import { EntityTab } from '../sidebar';
import type { AttachmentsPanelApi } from '../attachments';
import type { MediaAdminApi } from '../person/types';
import { nls } from '../nls';
import {
  createTaskTargetLabeler,
  moveItem,
  type MediaFileFacts,
  type MediaWithPath,
  type TaskTargetData,
} from '@doru/ui/domain';
import styles from './MediaTab.module.css';
import './MediaTab.css';

export function MediaTab({
  entityId,
  media,
  api,
  attachmentsApi,
  sources,
  targetData,
  onClose,
}: {
  entityId: string;
  media: MediaWithPath[];
  api: MediaAdminApi;
  attachmentsApi: AttachmentsPanelApi;
  sources: SourceRecord[];
  targetData: TaskTargetData;
  onClose: () => void;
}) {
  const mediaId = entityId;
  const record = media.find((entry) => entry.id === mediaId);
  if (!record) {
    return <p className="person-missing">{nls.t('features.tree.media.notFound')}</p>;
  }
  return (
    <MediaTabBody
      key={record.id}
      record={record}
      api={api}
      attachmentsApi={attachmentsApi}
      sources={sources}
      targetData={targetData}
      onClose={onClose}
    />
  );
}

function MediaTabBody({
  record,
  api,
  attachmentsApi,
  sources,
  targetData,
  onClose,
}: {
  record: MediaWithPath;
  api: MediaAdminApi;
  attachmentsApi: AttachmentsPanelApi;
  sources: SourceRecord[];
  targetData: TaskTargetData;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(record.title ?? '');
  const [date, setDate] = useState(() => toDateDraft(record.date));
  const [place, setPlace] = useState(record.place ?? '');
  const [placeId, setPlaceId] = useState(record.placeId ?? '');
  const [objectType, setObjectType] = useState(record.objectType ?? '');
  const [description, setDescription] = useState(record.description ?? '');
  const [keywords, setKeywords] = useState(record.keywords ?? '');
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
  const targetLabel = createTaskTargetLabeler(targetData);
  const recordRef = useRef(record);
  const baselineRef = useRef<MediaRecord>(record);
  const metadataRef = useRef({
    title,
    date,
    place,
    placeId,
    objectType,
    description,
    keywords,
  });

  useEffect(() => {
    metadataRef.current = { title, date, place, placeId, objectType, description, keywords };
  }, [title, date, place, placeId, objectType, description, keywords]);

  useEffect(() => {
    if (record === recordRef.current) {
      return;
    }
    const previous = recordRef.current;
    recordRef.current = record;
    if (mediaMetadataMatches(metadataRef.current, previous)) {
      baselineRef.current = record;
      setTitle(record.title ?? '');
      setDate(toDateDraft(record.date));
      setPlace(record.place ?? '');
      setPlaceId(record.placeId ?? '');
      setObjectType(record.objectType ?? '');
      setDescription(record.description ?? '');
      setKeywords(record.keywords ?? '');
      return;
    }
    // Keep the user's edits, but advance the baseline for every field they
    // did not touch so a later save reads those values from the current row.
    const draft = metadataRef.current;
    const base = baselineRef.current;
    const refreshed: MediaRecord = { ...record };
    if (draft.title === (base.title ?? '')) {
      refreshed.title = record.title;
    }
    if (dateDraftsEqual(draft.date, toDateDraft(base.date))) {
      refreshed.date = record.date;
    }
    if (draft.place === (base.place ?? '') && draft.placeId === (base.placeId ?? '')) {
      refreshed.place = record.place;
      refreshed.placeId = record.placeId;
    }
    if (draft.objectType === (base.objectType ?? '')) {
      refreshed.objectType = record.objectType;
    }
    if (draft.description === (base.description ?? '')) {
      refreshed.description = record.description;
    }
    if (draft.keywords === (base.keywords ?? '')) {
      refreshed.keywords = record.keywords;
    }
    baselineRef.current = refreshed;
  }, [record]);

  const save = async () => {
    const base = baselineRef.current;
    const next: MediaRecord = { ...record };
    if (title.trim() !== (base.title ?? '')) {
      next.title = title.trim() || undefined;
    }
    if (!dateDraftsEqual(date, toDateDraft(base.date))) {
      next.date = fromDateDraft(date, record.date);
    }
    if (place.trim() !== (base.place ?? '') || placeId !== (base.placeId ?? '')) {
      next.place = place.trim() || undefined;
      next.placeId = placeId || undefined;
    }
    if (objectType.trim() !== (base.objectType ?? '')) {
      next.objectType = objectType.trim() || undefined;
    }
    if (description.trim() !== (base.description ?? '')) {
      next.description = description.trim() || undefined;
    }
    if (keywords.trim() !== (base.keywords ?? '')) {
      next.keywords = keywords.trim() || undefined;
    }
    await api.updateMedia(record, next);
    baselineRef.current = next;
  };

  const remove = async () => {
    if (!window.confirm(nls.t('features.tree.media.deleteConfirm'))) {
      return;
    }
    await api.deleteMedia(record);
    onClose();
  };

  const addFiles = async () => {
    await api.addMediaFile(record.id);
  };

  const removeFile = async (file: MediaFile) => {
    if (!window.confirm(nls.t('features.tree.media.removeFileConfirm'))) {
      return;
    }
    await api.removeMediaFile(record, file);
  };

  const moveFile = async (index: number, to: number) => {
    const files = moveItem(record.files ?? [], index, to);
    await api.updateMedia(record, { ...record, files });
  };

  const saveFileTitle = async (file: MediaFile, value: string) => {
    if ((file.title ?? '') === value.trim()) {
      return;
    }
    const after: MediaRecord = {
      ...record,
      files: (record.files ?? []).map((entry) =>
        entry.id === file.id ? { ...entry, title: value.trim() || undefined } : entry,
      ),
    };
    await api.updateMedia(record, after);
  };

  const first = record.files?.find((file) => file.absolutePath !== '');
  return (
    <EntityTab>
      <EntityViewCard
        media={
          first !== undefined && first.absolutePath !== '' && isImagePath(first.path) ? (
            <img
              className="media-tab-preview"
              src={`doru-media://local/?path=${encodeURIComponent(first.absolutePath)}`}
              alt={title || record.title || ''}
            />
          ) : (
            <FileImage size={20} aria-hidden="true" />
          )
        }
        title={title.trim() || '—'}
        subtitle={nls.t('features.tree.media.fileCount', record.files?.length ?? 0)}
        actions={
          <>
            <Button variant="primary" size="sm" onClick={() => void save()}>
              {nls.t('features.tree.save')}
            </Button>
            <Button variant="danger" size="sm" onClick={() => void remove()}>
              {nls.t('features.tree.fact.delete')}
            </Button>
          </>
        }
      />

      <SectionCard title={nls.t('features.tree.media.details')}>
        <Field label={nls.t('features.tree.media.titleField')}>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <DateEditor label={nls.t('features.tree.media.date')} value={date} onChange={setDate} hidePlace />
        <FieldGrid columns={2}>
          <Field label={nls.t('features.tree.media.place')}>
            <Select
              value={placeId}
              onChange={(event) => {
                const value = event.target.value;
                setPlaceId(value);
                const selected = targetData.places.find((entry) => entry.id === value);
                if (selected !== undefined) {
                  setPlace(placeName(selected));
                }
              }}
            >
              <option value="">{nls.t('features.tasks.none')}</option>
              {targetData.places.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {placeName(entry)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={nls.t('features.tree.media.placeText')}>
            <Input
              value={place}
              onChange={(event) => {
                setPlace(event.target.value);
                if (placeId !== '') {
                  setPlaceId('');
                }
              }}
            />
          </Field>
        </FieldGrid>
        <FieldGrid columns={2}>
          <Field label={nls.t('features.tree.media.objectType')}>
            <Input value={objectType} onChange={(event) => setObjectType(event.target.value)} />
          </Field>
          <Field label={nls.t('features.tree.media.keywords')}>
            <Input value={keywords} onChange={(event) => setKeywords(event.target.value)} />
          </Field>
        </FieldGrid>
        <Field label={nls.t('features.tree.media.description')}>
          <Textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
      </SectionCard>

      <SectionCard title={nls.t('features.tree.media.files')}>
        <ul className="media-file-list">
          {(record.files ?? []).map((file, index) => (
            <li key={file.id} className="media-file-item">
              <div className="media-file-row">
                {file.absolutePath !== '' && isImagePath(file.path) ? (
                  <img
                    className="media-file-thumb"
                    src={`doru-media://local/?path=${encodeURIComponent(file.absolutePath)}`}
                    alt={file.title ?? ''}
                  />
                ) : (
                  <ImageIcon size={18} aria-hidden="true" />
                )}
                <div className={styles['fileMeta']}>
                  <span className="media-file-path">{file.path}</span>
                  <MetadataText className={styles['fileFacts']}>{factsLabel(file.facts)}</MetadataText>
                </div>
                <Input
                  aria-label={nls.t('features.tree.media.fileTitle')}
                  placeholder={nls.t('features.tree.media.fileTitle')}
                  defaultValue={file.title ?? ''}
                  onBlur={(event) => void saveFileTitle(file, event.target.value)}
                />
                <span className="media-file-reorder">
                  <ReorderButtons
                    upLabel={nls.t('features.tree.reorder.up')}
                    downLabel={nls.t('features.tree.reorder.down')}
                    canMoveUp={index > 0}
                    canMoveDown={index < (record.files?.length ?? 0) - 1}
                    onMoveUp={() => void moveFile(index, index - 1)}
                    onMoveDown={() => void moveFile(index, index + 1)}
                  />
                </span>
                <IconButton
                  size="sm"
                  label={nls.t('features.tree.attachments.show')}
                  icon={<Paperclip size={13} aria-hidden="true" />}
                  onClick={() => setExpandedFileId(expandedFileId === file.id ? null : file.id)}
                />
                <Button variant="secondary" size="sm" onClick={() => void removeFile(file)}>
                  <X size={13} aria-hidden="true" />
                  {nls.t('features.tree.media.remove')}
                </Button>
              </div>
              {expandedFileId === file.id && (
                <AttachmentsPanel targetType="media_file" targetId={file.id} api={attachmentsApi} sources={sources} />
              )}
            </li>
          ))}
        </ul>
        <Button variant="primary" onClick={() => void addFiles()}>
          {nls.t('features.tree.media.addFiles')}
        </Button>
      </SectionCard>

      <SectionCard title={nls.t('features.tree.media.links')}>
        <ul className="media-link-list">
          {(record.links ?? []).map((link) => (
            <MediaLinkRow
              key={link.id}
              link={link}
              targetLabel={targetLabel(link.targetType, link.targetId)}
              canDetach={(record.links?.length ?? 0) > 1}
              attachmentsApi={attachmentsApi}
              sources={sources}
              onSave={(after) => api.updateMediaLink(link, after)}
              onDetach={async () => {
                if ((record.links?.length ?? 0) > 1) {
                  await api.detachMedia(link);
                } else {
                  if (!window.confirm(nls.t('features.tree.media.deleteConfirm'))) {
                    return;
                  }
                  await api.deleteMedia(record);
                  onClose();
                }
              }}
            />
          ))}
        </ul>
      </SectionCard>

      <AttachmentsPanel targetType="media" targetId={record.id} api={attachmentsApi} sources={sources} />
    </EntityTab>
  );
}

function MediaLinkRow({
  link,
  targetLabel,
  canDetach,
  attachmentsApi,
  sources,
  onSave,
  onDetach,
}: {
  link: MediaLinkRecord;
  targetLabel: string;
  canDetach: boolean;
  attachmentsApi: AttachmentsPanelApi;
  sources: SourceRecord[];
  onSave: (link: MediaLinkRecord) => Promise<void>;
  onDetach: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<MediaLinkRecord>(link);
  const [showSources, setShowSources] = useState(false);
  const set = (patch: Partial<MediaLinkRecord>) => setDraft({ ...draft, ...patch });

  return (
    <li className="media-link-row">
      <div className="media-link-target">
        <strong>{link.targetType}</strong>
        <span>{targetLabel}</span>
      </div>
      <FieldGrid columns={2}>
        <Field label={nls.t('features.tree.media.linkTitle')}>
          <Input value={draft.title ?? ''} onChange={(event) => set({ title: event.target.value || undefined })} />
        </Field>
        <Field label={nls.t('features.tree.media.sequence')}>
          <Input
            type="number"
            value={draft.sequence ?? ''}
            onChange={(event) => set({ sequence: event.target.value === '' ? undefined : Number(event.target.value) })}
          />
        </Field>
      </FieldGrid>
      <FieldGrid columns={2}>
        {(['top', 'left', 'height', 'width'] as const).map((edge) => (
          <Field key={edge} label={nls.t(`features.tree.media.crop.${edge}`)}>
            <Input
              type="number"
              value={draft.crop?.[edge] ?? ''}
              onChange={(event) => {
                const value = event.target.value === '' ? undefined : Number(event.target.value);
                set({ crop: { ...draft.crop, [edge]: value } });
              }}
            />
          </Field>
        ))}
      </FieldGrid>
      <div className="media-link-flags">
        <Checkbox
          label={nls.t('features.tree.media.primary')}
          checked={draft.primary === true}
          onChange={(event) => set({ primary: event.target.checked })}
        />
        <Checkbox
          label={nls.t('features.tree.media.caption')}
          checked={draft.caption === true}
          onChange={(event) => set({ caption: event.target.checked })}
        />
        <Checkbox
          label={nls.t('features.tree.media.exclude')}
          checked={draft.exclude === true}
          onChange={(event) => set({ exclude: event.target.checked })}
        />
        <Checkbox
          label={nls.t('features.tree.media.scrapbook')}
          checked={draft.scrapbook === true}
          onChange={(event) => set({ scrapbook: event.target.checked })}
        />
        <Checkbox
          label={nls.t('features.tree.media.slideshow')}
          checked={draft.slideshow === true}
          onChange={(event) => set({ slideshow: event.target.checked })}
        />
        <Checkbox
          label={nls.t('features.tree.media.thumbnail')}
          checked={draft.thumbnail === true}
          onChange={(event) => set({ thumbnail: event.target.checked })}
        />
      </div>
      <div className="media-link-actions">
        <Button variant="primary" size="sm" onClick={() => void onSave(draft)}>
          {nls.t('features.tree.save')}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => void onDetach()}>
          {canDetach ? nls.t('features.tree.media.detach') : nls.t('features.tree.fact.delete')}
        </Button>
        <IconButton
          size="sm"
          label={nls.t('features.tree.media.linkSources')}
          icon={<Paperclip size={13} aria-hidden="true" />}
          onClick={() => setShowSources(!showSources)}
        />
      </div>
      {showSources && (
        <AttachmentsPanel
          targetType="media_link"
          targetId={link.id}
          api={attachmentsApi}
          sources={sources}
          sections={['sources']}
        />
      )}
    </li>
  );
}

/** True when the metadata draft still equals the stored media record. */
function mediaMetadataMatches(
  values: {
    title: string;
    date: ReturnType<typeof toDateDraft>;
    place: string;
    placeId: string;
    objectType: string;
    description: string;
    keywords: string;
  },
  record: MediaWithPath,
): boolean {
  return (
    values.title.trim() === (record.title ?? '') &&
    dateDraftsEqual(values.date, toDateDraft(record.date)) &&
    values.place.trim() === (record.place ?? '') &&
    values.placeId === (record.placeId ?? '') &&
    values.objectType.trim() === (record.objectType ?? '') &&
    values.description.trim() === (record.description ?? '') &&
    values.keywords.trim() === (record.keywords ?? '')
  );
}

function factsLabel(facts: MediaFileFacts | undefined): string {
  if (facts === undefined) {
    return nls.t('features.tree.media.facts.unknown');
  }
  const parts = [`${nls.t('features.tree.media.facts.format')}: ${facts.mime}`];
  if (facts.size !== undefined) {
    parts.push(`${nls.t('features.tree.media.facts.size')}: ${formatBytes(facts.size)}`);
  }
  if (facts.width !== undefined && facts.height !== undefined) {
    parts.push(`${nls.t('features.tree.media.facts.dimensions')}: ${facts.width} × ${facts.height}`);
  }
  return parts.join(' · ');
}

function formatBytes(size: number): string {
  const integer = new Intl.NumberFormat(nls.locale).format(size);
  if (size < 1024) {
    return nls.t('features.tree.media.bytes.b', integer);
  }
  const value = new Intl.NumberFormat(nls.locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  if (size < 1024 * 1024) {
    return nls.t('features.tree.media.bytes.kb', value.format(size / 1024));
  }
  return nls.t('features.tree.media.bytes.mb', value.format(size / (1024 * 1024)));
}

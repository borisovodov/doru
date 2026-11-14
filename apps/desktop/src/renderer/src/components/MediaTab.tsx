import { useState } from 'react';
import { FileImage, Image as ImageIcon, Paperclip, X } from 'lucide-react';
import type { MediaFile, MediaLinkRecord, MediaRecord, SourceRecord } from '@doru/core';
import {
  Button,
  Checkbox,
  EntityViewCard,
  Field,
  FieldGrid,
  IconButton,
  Input,
  ReorderButtons,
  SectionCard,
} from '@doru/ui';
import { AttachmentsPanel, EntityTab, type AttachmentsPanelApi, type MediaAdminApi } from '@doru/features';
import { nls } from '@doru/workbench';
import { moveItem, type MediaWithPath } from '@doru/ui/domain';
import { MEDIA_TAB_PREFIX } from '../hooks/useTabs';
import './MediaTab.css';

export function MediaTab({
  tabId,
  media,
  api,
  attachmentsApi,
  sources,
  onClose,
}: {
  tabId: string;
  media: MediaWithPath[];
  api: MediaAdminApi;
  attachmentsApi: AttachmentsPanelApi;
  sources: SourceRecord[];
  onClose: (tabId: string) => void;
}) {
  const mediaId = tabId.slice(MEDIA_TAB_PREFIX.length);
  const record = media.find((entry) => entry.id === mediaId);
  if (!record) {
    return <p className="person-missing">{nls.t('features.tree.media.notFound')}</p>;
  }
  return (
    <MediaTabBody
      key={record.id}
      tabId={tabId}
      record={record}
      api={api}
      attachmentsApi={attachmentsApi}
      sources={sources}
      onClose={onClose}
    />
  );
}

function MediaTabBody({
  tabId,
  record,
  api,
  attachmentsApi,
  sources,
  onClose,
}: {
  tabId: string;
  record: MediaWithPath;
  api: MediaAdminApi;
  attachmentsApi: AttachmentsPanelApi;
  sources: SourceRecord[];
  onClose: (tabId: string) => void;
}) {
  const [title, setTitle] = useState(record.title ?? '');
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);

  const save = async () => {
    await api.updateMedia(record, { ...record, title: title.trim() || undefined });
  };

  const remove = async () => {
    await api.deleteMedia(record);
    onClose(tabId);
  };

  const addFiles = async () => {
    await api.addMediaFile(record.id);
  };

  const removeFile = async (file: MediaFile) => {
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

  const first = record.files?.[0];
  return (
    <EntityTab>
      <EntityViewCard
        media={
          first !== undefined ? (
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
      </SectionCard>

      <SectionCard title={nls.t('features.tree.media.files')}>
        <ul className="media-file-list">
          {(record.files ?? []).map((file, index) => (
            <li key={file.id} className="media-file-item">
              <div className="media-file-row">
                {isImage(file.path) ? (
                  <img
                    className="media-file-thumb"
                    src={`doru-media://local/?path=${encodeURIComponent(file.absolutePath)}`}
                    alt={file.title ?? ''}
                  />
                ) : (
                  <ImageIcon size={18} aria-hidden="true" />
                )}
                <span className="media-file-path">{file.path}</span>
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
              canDetach={(record.links?.length ?? 0) > 1}
              onSave={(after) => api.updateMediaLink(link, after)}
              onDetach={async () => {
                if ((record.links?.length ?? 0) > 1) {
                  await api.detachMedia(link);
                } else {
                  await api.deleteMedia(record);
                  onClose(tabId);
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
  canDetach,
  onSave,
  onDetach,
}: {
  link: MediaLinkRecord;
  canDetach: boolean;
  onSave: (link: MediaLinkRecord) => Promise<void>;
  onDetach: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<MediaLinkRecord>(link);
  const set = (patch: Partial<MediaLinkRecord>) => setDraft({ ...draft, ...patch });

  return (
    <li className="media-link-row">
      <div className="media-link-target">
        <strong>{link.targetType}</strong>
        <span>{link.targetId}</span>
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
      </div>
    </li>
  );
}

function isImage(path: string): boolean {
  const dot = path.lastIndexOf('.');
  if (dot === -1) {
    return false;
  }
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'tiff'].includes(path.slice(dot + 1).toLowerCase());
}

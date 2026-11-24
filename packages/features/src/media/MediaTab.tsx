import { useEffect, useRef, useState } from 'react';
import { FileImage, Image as ImageIcon, Paperclip, X } from 'lucide-react';
import {
  isImagePath,
  placeName,
  type MediaFile,
  type MediaLinkRecord,
  type MediaRecord,
  type SourceRecord,
  type TargetRef,
  TARGET_TYPES,
} from '@doru/core/model';
import {
  Button,
  Checkbox,
  DangerZone,
  EntityViewCard,
  Field,
  FieldGrid,
  IconButton,
  InlineError,
  Input,
  MetadataText,
  ReorderButtons,
  SectionCard,
  Select,
  Textarea,
  useAutoSaveOnBlur,
} from '@doru/ui';
import { DateEditor, TargetPicker, dateDraftsEqual, fromDateDraft, toDateDraft } from '@doru/ui/domain';
import { AttachmentsPanel } from '../attachments';
import { AutoSaveError } from '../autoSaveFeedback';
import { useEntityDelete } from '../entityDelete';
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

type MediaDraftSnapshot = {
  title: string;
  date: ReturnType<typeof toDateDraft>;
  place: string;
  placeId: string;
  objectType: string;
  description: string;
  keywords: string;
  fileTitles: Record<string, string>;
};

type MediaDirtyFields = {
  title: boolean;
  date: boolean;
  place: boolean;
  objectType: boolean;
  description: boolean;
  keywords: boolean;
  files: boolean;
};

function fileTitlesFrom(files: MediaFile[] | undefined): Record<string, string> {
  const titles: Record<string, string> = {};
  for (const file of files ?? []) {
    titles[file.id] = file.title ?? '';
  }
  return titles;
}

function normalizeTitle(value: string | undefined): string {
  return (value ?? '').trim();
}

function sameTitleMaps(left: Record<string, string>, right: Record<string, string>): boolean {
  const ids = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const id of ids) {
    if (normalizeTitle(left[id]) !== normalizeTitle(right[id])) {
      return false;
    }
  }
  return true;
}

function changedFileTitles(base: Record<string, string>, submitted: Record<string, string>): Record<string, string> {
  const changes: Record<string, string> = {};
  const ids = new Set([...Object.keys(base), ...Object.keys(submitted)]);
  for (const id of ids) {
    if (normalizeTitle(base[id]) !== normalizeTitle(submitted[id])) {
      changes[id] = submitted[id] ?? '';
    }
  }
  return changes;
}

function sameFileTitles(files: MediaFile[] | undefined, titles: Record<string, string>): boolean {
  return sameTitleMaps(fileTitlesFrom(files), titles);
}

function applyFileTitles(files: MediaFile[] | undefined, titles: Record<string, string>): MediaFile[] {
  return (files ?? []).map((file) => {
    if (!Object.hasOwn(titles, file.id)) {
      return file;
    }
    const next: MediaFile = { ...file };
    const title = titles[file.id]?.trim();
    if (title !== undefined && title !== '') {
      next.title = title;
    } else {
      delete next.title;
    }
    return next;
  });
}

/** Keeps local title edits and adopts refreshed titles for untouched files. */
function mergeFileTitles(
  current: Record<string, string>,
  previous: Record<string, string>,
  refreshed: Record<string, string>,
): Record<string, string> {
  const merged: Record<string, string> = {};
  const ids = new Set([...Object.keys(current), ...Object.keys(previous), ...Object.keys(refreshed)]);
  for (const id of ids) {
    const currentTitle = current[id];
    if (refreshed[id] === undefined) {
      // The file no longer exists; a stale title must not keep the tab dirty.
      continue;
    }
    if (normalizeTitle(currentTitle) === normalizeTitle(previous[id])) {
      merged[id] = refreshed[id];
    } else if (currentTitle !== undefined) {
      merged[id] = currentTitle;
    }
  }
  return merged;
}

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
  const [linkTargets, setLinkTargets] = useState<TargetRef[]>([]);
  const [linkError, setLinkError] = useState(false);
  const [fileTitles, setFileTitles] = useState<Record<string, string>>(() => fileTitlesFrom(record.files));
  const fileTitlesRef = useRef(fileTitles);
  const targetLabel = createTaskTargetLabeler(targetData);
  const attachMediaToTargets = api.attachMediaToTargets;
  const recordRef = useRef(record);
  const baselineRef = useRef<MediaRecord>(record);
  const savedRef = useRef<MediaRecord>(record);
  const savedMetadataRef = useRef<MediaRecord>(record);
  const submittedRef = useRef<MediaDraftSnapshot | undefined>(undefined);
  const submissionTokenRef = useRef<object | undefined>(undefined);
  const submittedDirtyRef = useRef<MediaDirtyFields | undefined>(undefined);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const queuedRecordRef = useRef<MediaRecord>(record);
  const pendingSavesRef = useRef(0);
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
    fileTitlesRef.current = fileTitles;
  }, [title, date, place, placeId, objectType, description, keywords, fileTitles]);

  useEffect(() => {
    if (record === recordRef.current) {
      return;
    }
    const previous = recordRef.current;
    recordRef.current = record;
    const submitted = submittedRef.current;
    const dirty = submittedDirtyRef.current;
    const savedTitles = fileTitlesFrom(savedMetadataRef.current.files);
    const refreshedTitles = fileTitlesFrom(record.files);
    // A refresh that still carries pre-write values (or any unrelated
    // snapshot) must not replace a draft whose write is still pending; wait
    // until the incoming record reflects the submitted fields.
    if (submitted !== undefined && dirty !== undefined && !mediaRecordHasSubmission(record, submitted, dirty)) {
      return;
    }
    submittedRef.current = undefined;
    submittedDirtyRef.current = undefined;
    savedRef.current = record;
    savedMetadataRef.current = record;
    if (
      submitted === undefined &&
      mediaMetadataMatches(metadataRef.current, previous) &&
      sameTitleMaps(fileTitlesRef.current, savedTitles)
    ) {
      baselineRef.current = record;
      fileTitlesRef.current = refreshedTitles;
      setFileTitles(refreshedTitles);
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
    const base =
      submitted ??
      ({
        title: baselineRef.current.title ?? '',
        date: toDateDraft(baselineRef.current.date),
        place: baselineRef.current.place ?? '',
        placeId: baselineRef.current.placeId ?? '',
        objectType: baselineRef.current.objectType ?? '',
        description: baselineRef.current.description ?? '',
        keywords: baselineRef.current.keywords ?? '',
      } as const);
    const refreshed: MediaRecord = { ...record };
    if (draft.title.trim() === base.title.trim()) {
      refreshed.title = record.title;
      setTitle(record.title ?? '');
    }
    if (mediaDateDraftPairEqual(draft.date, base.date, baselineRef.current.date)) {
      refreshed.date = record.date;
      setDate(toDateDraft(record.date));
    }
    if (draft.place.trim() === base.place.trim() && draft.placeId === base.placeId) {
      refreshed.place = record.place;
      refreshed.placeId = record.placeId;
      setPlace(record.place ?? '');
      setPlaceId(record.placeId ?? '');
    }
    if (draft.objectType.trim() === base.objectType.trim()) {
      refreshed.objectType = record.objectType;
      setObjectType(record.objectType ?? '');
    }
    if (draft.description.trim() === base.description.trim()) {
      refreshed.description = record.description;
      setDescription(record.description ?? '');
    }
    if (draft.keywords.trim() === base.keywords.trim()) {
      refreshed.keywords = record.keywords;
      setKeywords(record.keywords ?? '');
    }
    const mergedTitles = mergeFileTitles(fileTitlesRef.current, savedTitles, refreshedTitles);
    fileTitlesRef.current = mergedTitles;
    setFileTitles(mergedTitles);
    baselineRef.current = refreshed;
  }, [record]);

  /**
   * Merges a refresh that arrived while a write was pending. Fields this
   * submission did not touch adopt the refreshed values; edited fields keep
   * the draft (or the just-written value after a successful save) so a retry
   * still sends the user's change.
   */
  const reconcileAfterRefresh = (
    latest: MediaRecord,
    base: MediaRecord,
    dirty: MediaDirtyFields,
    submitted: MediaDraftSnapshot,
    next?: MediaRecord,
  ): MediaRecord => {
    const refreshed: MediaRecord = { ...latest };
    const draft = metadataRef.current;
    if (!dirty.title) {
      if (draft.title === submitted.title) {
        setTitle(latest.title ?? '');
      }
    } else {
      refreshed.title = (next ?? base).title;
    }
    if (!dirty.date) {
      if (JSON.stringify(draft.date) === JSON.stringify(submitted.date)) {
        setDate(toDateDraft(latest.date));
      }
    } else {
      refreshed.date = (next ?? base).date;
    }
    if (!dirty.place) {
      if (draft.place === submitted.place && draft.placeId === submitted.placeId) {
        setPlace(latest.place ?? '');
        setPlaceId(latest.placeId ?? '');
      }
    } else {
      refreshed.place = (next ?? base).place;
      refreshed.placeId = (next ?? base).placeId;
    }
    if (!dirty.objectType) {
      if (draft.objectType === submitted.objectType) {
        setObjectType(latest.objectType ?? '');
      }
    } else {
      refreshed.objectType = (next ?? base).objectType;
    }
    if (!dirty.description) {
      if (draft.description === submitted.description) {
        setDescription(latest.description ?? '');
      }
    } else {
      refreshed.description = (next ?? base).description;
    }
    if (!dirty.keywords) {
      if (draft.keywords === submitted.keywords) {
        setKeywords(latest.keywords ?? '');
      }
    } else {
      refreshed.keywords = (next ?? base).keywords;
    }
    if (!dirty.files || next !== undefined) {
      const acknowledged =
        next !== undefined
          ? { ...fileTitlesFrom(latest.files), ...fileTitlesFrom(next.files) }
          : fileTitlesFrom(latest.files);
      const titles = mergeFileTitles(fileTitlesRef.current, submitted.fileTitles, acknowledged);
      fileTitlesRef.current = titles;
      setFileTitles(titles);
    }
    refreshed.files =
      dirty.files && next !== undefined
        ? applyFileTitles(latest.files, changedFileTitles(fileTitlesFrom(base.files), submitted.fileTitles))
        : latest.files;
    baselineRef.current = refreshed;
    return refreshed;
  };

  const performSave = async (
    submission: MediaDraftSnapshot,
    base: MediaRecord,
    baseDraft: MediaDraftSnapshot,
  ): Promise<void> => {
    const token = {};
    submissionTokenRef.current = token;
    submittedRef.current = submission;
    const dirty: MediaDirtyFields = {
      title: submission.title.trim() !== baseDraft.title,
      date: !mediaDateDraftEqual(submission.date, base.date),
      place: submission.place.trim() !== baseDraft.place || submission.placeId !== baseDraft.placeId,
      objectType: submission.objectType.trim() !== baseDraft.objectType,
      description: submission.description.trim() !== baseDraft.description,
      keywords: submission.keywords.trim() !== baseDraft.keywords,
      files: !sameTitleMaps(submission.fileTitles, baseDraft.fileTitles),
    };
    submittedDirtyRef.current = dirty;
    // Use the latest saved state even while the refreshed prop is pending.
    const current = savedRef.current;
    const next: MediaRecord = { ...current };
    if (submission.title.trim() !== baseDraft.title) {
      next.title = submission.title.trim() || undefined;
    }
    if (!mediaDateDraftEqual(submission.date, base.date)) {
      next.date = fromDateDraft(submission.date, current.date);
    }
    if (submission.place.trim() !== baseDraft.place || submission.placeId !== baseDraft.placeId) {
      next.place = submission.place.trim() || undefined;
      next.placeId = submission.placeId || undefined;
    }
    if (submission.objectType.trim() !== baseDraft.objectType) {
      next.objectType = submission.objectType.trim() || undefined;
    }
    if (submission.description.trim() !== baseDraft.description) {
      next.description = submission.description.trim() || undefined;
    }
    if (submission.keywords.trim() !== baseDraft.keywords) {
      next.keywords = submission.keywords.trim() || undefined;
    }
    if (dirty.files) {
      next.files = applyFileTitles(current.files, changedFileTitles(baseDraft.fileTitles, submission.fileTitles));
    }
    const recordBeforeSave = recordRef.current;
    try {
      await api.updateMedia(current, next);
    } catch (error) {
      if (submissionTokenRef.current === token) {
        if (recordRef.current !== recordBeforeSave) {
          // A refresh arrived while the write was pending; retry from the
          // latest stored record so files added meanwhile are not dropped.
          savedRef.current = recordRef.current;
          savedMetadataRef.current = recordRef.current;
          reconcileAfterRefresh(recordRef.current, base, dirty, submission);
        }
        if (submittedRef.current === submission) {
          submittedRef.current = undefined;
          submittedDirtyRef.current = undefined;
          queuedRecordRef.current = savedRef.current;
        }
      }
      throw error;
    }
    // The write settled: retire only this save's submission gate, so an
    // older completion cannot clear a newer overlapping save.
    if (submissionTokenRef.current === token) {
      submittedRef.current = undefined;
      submittedDirtyRef.current = undefined;
      if (recordRef.current === recordBeforeSave) {
        baselineRef.current = next;
        savedRef.current = next;
        savedMetadataRef.current = next;
      } else {
        const refreshed = reconcileAfterRefresh(recordRef.current, base, dirty, submission, next);
        savedRef.current = refreshed;
        savedMetadataRef.current = refreshed;
      }
    }
  };

  const save = (): Promise<void> => {
    // Capture the click-time draft. Queued saves compare against the previous
    // submission, so a reversal (B then A) is not compared with stale A.
    const submission: MediaDraftSnapshot = {
      title,
      date,
      place,
      placeId,
      objectType,
      description,
      keywords,
      fileTitles: { ...fileTitlesRef.current },
    };
    if (pendingSavesRef.current === 0) {
      queuedRecordRef.current = savedRef.current;
    }
    const base = queuedRecordRef.current;
    const baseDraft: MediaDraftSnapshot = {
      title: base.title ?? '',
      date: toDateDraft(base.date),
      place: base.place ?? '',
      placeId: base.placeId ?? '',
      objectType: base.objectType ?? '',
      description: base.description ?? '',
      keywords: base.keywords ?? '',
      fileTitles: fileTitlesFrom(base.files),
    };
    const titleChanges = changedFileTitles(baseDraft.fileTitles, submission.fileTitles);
    const filesDirty = Object.keys(titleChanges).length > 0;
    const desired: MediaRecord = { ...base };
    if (submission.title.trim() !== baseDraft.title) {
      desired.title = submission.title.trim() || undefined;
    }
    if (!mediaDateDraftEqual(submission.date, base.date)) {
      desired.date = fromDateDraft(submission.date, base.date);
    }
    if (submission.place.trim() !== baseDraft.place || submission.placeId !== baseDraft.placeId) {
      desired.place = submission.place.trim() || undefined;
      desired.placeId = submission.placeId || undefined;
    }
    if (submission.objectType.trim() !== baseDraft.objectType) {
      desired.objectType = submission.objectType.trim() || undefined;
    }
    if (submission.description.trim() !== baseDraft.description) {
      desired.description = submission.description.trim() || undefined;
    }
    if (submission.keywords.trim() !== baseDraft.keywords) {
      desired.keywords = submission.keywords.trim() || undefined;
    }
    if (filesDirty) {
      desired.files = applyFileTitles(base.files, titleChanges);
    }
    queuedRecordRef.current = desired;
    pendingSavesRef.current += 1;
    const task: Promise<void> = saveChainRef.current
      .then(() => performSave(submission, base, baseDraft))
      .finally(() => {
        pendingSavesRef.current -= 1;
      });
    saveChainRef.current = task.catch(() => undefined);
    return task;
  };

  const autoSave = useAutoSaveOnBlur({
    enabled: true,
    isDirty: () =>
      !mediaMetadataMatches(metadataRef.current, savedMetadataRef.current) ||
      !sameFileTitles(savedMetadataRef.current.files, fileTitlesRef.current),
    save,
  });

  const deleteMedia = async () => {
    await api.deleteMedia(record);
  };

  const deletion = useEntityDelete(autoSave, deleteMedia, onClose);

  const remove = () => {
    if (deletion.deleting || !window.confirm(nls.t('features.tree.media.deleteConfirm'))) {
      return;
    }
    deletion.deleteEntity();
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

  const first = record.files?.find((file) => file.absolutePath !== '');
  return (
    <EntityTab onBlur={autoSave.onBlur}>
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
      />
      <AutoSaveError failed={autoSave.failed} retryDisabled={autoSave.pendingDelete} onRetry={autoSave.retry} />
      {deletion.failed ? <InlineError>{nls.t('features.tree.deleteFailed')}</InlineError> : null}

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
                  value={fileTitles[file.id] ?? file.title ?? ''}
                  onChange={(event) => setFileTitles((current) => ({ ...current, [file.id]: event.target.value }))}
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
                <AttachmentsPanel
                  targetType="media_file"
                  targetId={file.id}
                  api={attachmentsApi}
                  sources={sources}
                  onOpenSource={(sourceId) => api.openSource?.(sourceId)}
                />
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
              onOpenSource={(sourceId) => api.openSource?.(sourceId)}
              onSave={(after) => api.updateMediaLink(link, after)}
              deletingMedia={deletion.deleting}
              onDetach={() => {
                if ((record.links?.length ?? 0) > 1) {
                  void api.detachMedia(link);
                } else {
                  remove();
                }
              }}
            />
          ))}
        </ul>
        {attachMediaToTargets !== undefined && (
          <>
            <div className="media-link-add">
              <TargetPicker
                allowedTypes={TARGET_TYPES}
                value={linkTargets}
                onChange={setLinkTargets}
                ariaLabel={nls.t('features.tasks.target')}
              />
              <Button
                variant="primary"
                size="sm"
                disabled={linkTargets.length === 0}
                onClick={() => {
                  setLinkError(false);
                  const submitted = linkTargets;
                  void attachMediaToTargets(record.id, submitted)
                    .then(() =>
                      setLinkTargets((current) =>
                        current.filter(
                          (target) =>
                            !submitted.some(
                              (entry) => entry.targetType === target.targetType && entry.targetId === target.targetId,
                            ),
                        ),
                      ),
                    )
                    .catch(() => setLinkError(true));
                }}
              >
                {nls.t('features.tree.media.attach')}
              </Button>
            </div>
            {linkError ? <InlineError>{nls.t('features.tree.autosaveFailed')}</InlineError> : null}
          </>
        )}
      </SectionCard>

      <AttachmentsPanel
        targetType="media"
        targetId={record.id}
        api={attachmentsApi}
        sources={sources}
        onOpenSource={(sourceId) => api.openSource?.(sourceId)}
      />
      <DangerZone>
        <Button variant="danger" size="sm" data-autosave-skip="true" disabled={deletion.deleting} onClick={remove}>
          {nls.t('features.tree.fact.delete')}
        </Button>
      </DangerZone>
    </EntityTab>
  );
}

function MediaLinkRow({
  link,
  targetLabel,
  canDetach,
  attachmentsApi,
  sources,
  onOpenSource,
  onSave,
  onDetach,
  deletingMedia,
}: {
  link: MediaLinkRecord;
  targetLabel: string;
  canDetach: boolean;
  attachmentsApi: AttachmentsPanelApi;
  sources: SourceRecord[];
  onOpenSource: (sourceId: string) => void;
  onSave: (link: MediaLinkRecord) => Promise<void>;
  onDetach: () => void;
  deletingMedia: boolean;
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
        <Button variant="secondary" size="sm" disabled={deletingMedia} onClick={onDetach}>
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
          onOpenSource={onOpenSource}
          sections={['sources']}
        />
      )}
    </li>
  );
}

/** True when the stored record already contains every submitted (dirty) field. */
function mediaRecordHasSubmission(
  record: MediaWithPath,
  values: {
    title: string;
    date: ReturnType<typeof toDateDraft>;
    place: string;
    placeId: string;
    objectType: string;
    description: string;
    keywords: string;
    fileTitles: Record<string, string>;
  },
  dirty: {
    title: boolean;
    date: boolean;
    place: boolean;
    objectType: boolean;
    description: boolean;
    keywords: boolean;
    files: boolean;
  },
): boolean {
  return (
    (!dirty.title || values.title.trim() === (record.title ?? '')) &&
    (!dirty.date || dateDraftsEqual(toDateDraft(fromDateDraft(values.date, record.date)), toDateDraft(record.date))) &&
    (!dirty.place || (values.place.trim() === (record.place ?? '') && values.placeId === (record.placeId ?? ''))) &&
    (!dirty.objectType || values.objectType.trim() === (record.objectType ?? '')) &&
    (!dirty.description || values.description.trim() === (record.description ?? '')) &&
    (!dirty.keywords || values.keywords.trim() === (record.keywords ?? '')) &&
    (!dirty.files || sameTitleMaps(fileTitlesFrom(record.files), values.fileTitles))
  );
}

/** Compares drafts by the date they save, not by their raw typed text. */
function mediaDateDraftEqual(
  draft: ReturnType<typeof toDateDraft>,
  base?: Parameters<typeof fromDateDraft>[1],
): boolean {
  return dateDraftsEqual(toDateDraft(fromDateDraft(draft, base)), toDateDraft(base));
}

function mediaDateDraftPairEqual(
  draft: ReturnType<typeof toDateDraft>,
  baseDraft: ReturnType<typeof toDateDraft>,
  base?: Parameters<typeof fromDateDraft>[1],
): boolean {
  return dateDraftsEqual(toDateDraft(fromDateDraft(draft, base)), toDateDraft(fromDateDraft(baseDraft, base)));
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
  record: MediaRecord,
): boolean {
  return (
    values.title.trim() === (record.title ?? '') &&
    mediaDateDraftEqual(values.date, record.date) &&
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

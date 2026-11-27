import { useEffect, useRef, useState } from 'react';
import { FileImage } from 'lucide-react';
import {
  isExternalMediaPath,
  isImagePath,
  mediaDisplayName,
  type MediaLinkRecord,
  type MediaRecord,
  type SourceRecord,
  type TargetRef,
  MEDIA_LINK_TARGET_TYPES,
} from '@doru/core/model';
import {
  Button,
  Checkbox,
  DangerZone,
  EntityViewCard,
  Field,
  FieldGrid,
  InlineError,
  Input,
  MetadataText,
  SectionCard,
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
import { createTaskTargetLabeler, type MediaFileFacts, type MediaWithPath, type TaskTargetData } from '@doru/ui/domain';
import styles from './MediaTab.module.css';
import './MediaTab.css';

type MediaDraftSnapshot = {
  title: string;
  date: ReturnType<typeof toDateDraft>;
};

type MediaDirtyFields = {
  title: boolean;
  date: boolean;
};

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
  const [linkTargets, setLinkTargets] = useState<TargetRef[]>([]);
  const [linkError, setLinkError] = useState(false);
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
  const metadataRef = useRef({ title, date });

  useEffect(() => {
    metadataRef.current = { title, date };
  }, [title, date]);

  useEffect(() => {
    if (record === recordRef.current) {
      return;
    }
    const previous = recordRef.current;
    recordRef.current = record;
    const submitted = submittedRef.current;
    const dirty = submittedDirtyRef.current;
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
    if (submitted === undefined && mediaMetadataMatches(metadataRef.current, previous)) {
      baselineRef.current = record;
      setTitle(record.title ?? '');
      setDate(toDateDraft(record.date));
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
  ): MediaRecord => {
    const refreshed: MediaRecord = { ...latest };
    const draft = metadataRef.current;
    if (!dirty.title) {
      if (draft.title === submitted.title) {
        setTitle(latest.title ?? '');
      }
    } else {
      refreshed.title = base.title;
    }
    if (!dirty.date) {
      if (JSON.stringify(draft.date) === JSON.stringify(submitted.date)) {
        setDate(toDateDraft(latest.date));
      }
    } else {
      refreshed.date = base.date;
    }
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
        const refreshed = reconcileAfterRefresh(recordRef.current, next, dirty, submission);
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
    };
    if (pendingSavesRef.current === 0) {
      queuedRecordRef.current = savedRef.current;
    }
    const base = queuedRecordRef.current;
    const baseDraft: MediaDraftSnapshot = {
      title: base.title ?? '',
      date: toDateDraft(base.date),
    };
    const desired: MediaRecord = { ...base };
    if (submission.title.trim() !== baseDraft.title) {
      desired.title = submission.title.trim() || undefined;
    }
    if (!mediaDateDraftEqual(submission.date, base.date)) {
      desired.date = fromDateDraft(submission.date, base.date);
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
    isDirty: () => !mediaMetadataMatches(metadataRef.current, savedMetadataRef.current),
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

  const external = isExternalMediaPath(record.path);
  const hasPreview = !external && record.absolutePath !== '' && isImagePath(record.path);
  const displayName = mediaDisplayName({ title, path: record.path });
  return (
    <EntityTab onBlur={autoSave.onBlur}>
      <EntityViewCard
        media={
          hasPreview ? (
            <img
              className="media-tab-preview"
              src={`doru-media://local/?path=${encodeURIComponent(record.absolutePath)}`}
              alt={displayName ?? ''}
            />
          ) : (
            <FileImage size={20} aria-hidden="true" />
          )
        }
        title={displayName ?? '—'}
        subtitle={null}
      />
      <AutoSaveError failed={autoSave.failed} retryDisabled={autoSave.pendingDelete} onRetry={autoSave.retry} />
      {deletion.failed ? <InlineError>{nls.t('features.tree.deleteFailed')}</InlineError> : null}

      <SectionCard title={nls.t('features.tree.media.details')}>
        <Field label={nls.t('features.tree.media.titleField')}>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <DateEditor label={nls.t('features.tree.media.date')} value={date} onChange={setDate} hidePlace />
        {external ? (
          <MetadataText className={styles['fileFacts']}>{factsLabel(undefined)}</MetadataText>
        ) : (
          <div className={styles['fileMeta']}>
            <span className="media-file-path">{record.path}</span>
            <MetadataText className={styles['fileFacts']}>{factsLabel(record.facts)}</MetadataText>
          </div>
        )}
      </SectionCard>

      <SectionCard title={nls.t('features.tree.media.links')}>
        <ul className="media-link-list">
          {(record.links ?? []).map((link) => (
            <MediaLinkRow
              key={link.id}
              link={link}
              targetLabel={targetLabel(link.targetType, link.targetId)}
              canDetach={(record.links?.length ?? 0) > 1}
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
      </SectionCard>

      <AttachmentsPanel
        targetType="media"
        targetId={record.id}
        api={attachmentsApi}
        sources={sources}
        onOpenSource={(sourceId) => api.openSource?.(sourceId)}
      />
      {attachMediaToTargets !== undefined && (
        <SectionCard title={nls.t('features.tasks.target')}>
          <div className="media-link-add">
            <TargetPicker
              allowedTypes={MEDIA_LINK_TARGET_TYPES}
              value={linkTargets}
              onChange={setLinkTargets}
              ariaLabel={nls.t('features.tasks.target')}
            />
            <Button
              variant="secondary"
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
        </SectionCard>
      )}
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
  onSave,
  onDetach,
  deletingMedia,
}: {
  link: MediaLinkRecord;
  targetLabel: string;
  canDetach: boolean;
  onSave: (link: MediaLinkRecord) => Promise<void>;
  onDetach: () => void;
  deletingMedia: boolean;
}) {
  const [draft, setDraft] = useState<MediaLinkRecord>(link);
  const set = (patch: Partial<MediaLinkRecord>) => setDraft({ ...draft, ...patch });

  return (
    <li className="media-link-row">
      <div className="media-link-target">
        <strong>{link.targetType}</strong>
        <span>{targetLabel}</span>
      </div>
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
      </div>
      <div className="media-link-actions">
        <Button variant="primary" size="sm" onClick={() => void onSave(draft)}>
          {nls.t('features.tree.save')}
        </Button>
        <Button variant="secondary" size="sm" disabled={deletingMedia} onClick={onDetach}>
          {canDetach ? nls.t('features.tree.media.detach') : nls.t('features.tree.fact.delete')}
        </Button>
      </div>
    </li>
  );
}

/** True when the stored record already contains every submitted (dirty) field. */
function mediaRecordHasSubmission(
  record: MediaWithPath,
  values: {
    title: string;
    date: ReturnType<typeof toDateDraft>;
  },
  dirty: {
    title: boolean;
    date: boolean;
  },
): boolean {
  return (
    (!dirty.title || values.title.trim() === (record.title ?? '')) &&
    (!dirty.date || dateDraftsEqual(toDateDraft(fromDateDraft(values.date, record.date)), toDateDraft(record.date)))
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
  },
  record: MediaRecord,
): boolean {
  return values.title.trim() === (record.title ?? '') && mediaDateDraftEqual(values.date, record.date);
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

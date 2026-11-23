import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, DangerZone, EntityViewCard, InlineError, SectionCard, useAutoSaveOnBlur } from '@doru/ui';
import { MEDIA_VISIBLE } from '@doru/platform';
import { AutoSaveError } from '../autoSaveFeedback';
import { ListTodo } from 'lucide-react';
import type {
  AddressRecord,
  AssociationRecord,
  CitationRecord,
  FactRecord,
  FamilyRecord,
  MediaRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TitleRecord,
  TaskRecord,
} from '@doru/core';
import { AttachmentsPanel } from '../attachments';
import { EntityTab } from '../sidebar';
import type { TaskEditorApi } from '../person/types';
import {
  TASK_TARGET_TYPES,
  TaskEditorFields,
  emptyTaskDraft,
  taskTargetLabel,
  taskDraftHasInvalidTimestamp,
  mergeTaskDraft,
  taskDraftToRecord,
  taskToDraft,
  type TaskDraft,
} from '@doru/ui/domain';
import { nls } from '../nls';

/** Media targets stay out of the picker while media editing is hidden. */
const VISIBLE_TARGET_TYPES = MEDIA_VISIBLE
  ? TASK_TARGET_TYPES
  : TASK_TARGET_TYPES.filter((type) => type !== 'media' && type !== 'media_file' && type !== 'media_link');

export function TaskTab({
  entityId,
  tasks,
  persons,
  families,
  sources,
  places,
  repositories,
  titles,
  facts,
  citations,
  notes,
  media,
  submitters,
  addresses,
  associations,
  api,
  onClose,
  onOpenMedia,
  onOpenSource,
  onCreated,
}: {
  entityId: string;
  tasks: TaskRecord[];
  persons: PersonRecord[];
  families: FamilyRecord[];
  sources: SourceRecord[];
  places: PlaceRecord[];
  repositories: RepositoryRecord[];
  titles: TitleRecord[];
  facts: FactRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  media: MediaRecord[];
  submitters: SubmitterRecord[];
  addresses: AddressRecord[];
  associations: AssociationRecord[];
  api: TaskEditorApi;
  onClose: () => void;
  onOpenMedia: (mediaId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const taskId = entityId;
  const isNew = taskId.startsWith('new:');
  const record = tasks.find((task) => task.id === taskId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tasks.notFound')}</p>;
  }
  return (
    <TaskTabBody
      record={record}
      isNew={isNew}
      tasks={tasks}
      persons={persons}
      families={families}
      sources={sources}
      places={places}
      repositories={repositories}
      titles={titles}
      facts={facts}
      citations={citations}
      notes={notes}
      media={media}
      submitters={submitters}
      addresses={addresses}
      associations={associations}
      api={api}
      onClose={onClose}
      onOpenMedia={onOpenMedia}
      onOpenSource={onOpenSource}
      onCreated={onCreated}
    />
  );
}

function TaskTabBody({
  record,
  isNew,
  tasks,
  persons,
  families,
  sources,
  places,
  repositories,
  titles,
  facts,
  citations,
  notes,
  media,
  submitters,
  addresses,
  associations,
  api,
  onClose,
  onOpenMedia,
  onOpenSource,
  onCreated,
}: {
  record: TaskRecord | undefined;
  isNew: boolean;
  tasks: TaskRecord[];
  persons: PersonRecord[];
  families: FamilyRecord[];
  sources: SourceRecord[];
  places: PlaceRecord[];
  repositories: RepositoryRecord[];
  titles: TitleRecord[];
  facts: FactRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  media: MediaRecord[];
  submitters: SubmitterRecord[];
  addresses: AddressRecord[];
  associations: AssociationRecord[];
  api: TaskEditorApi;
  onClose: () => void;
  onOpenMedia: (mediaId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const base = record ?? { id: crypto.randomUUID(), text: '' };
  const recordRef = useRef(record);
  const savedRef = useRef<TaskRecord>(record ?? base);
  const submittedRef = useRef<TaskDraft | undefined>(undefined);
  const submittedRecordRef = useRef<TaskRecord | undefined>(undefined);
  const submissionTokenRef = useRef<object | undefined>(undefined);
  const creatingRef = useRef(false);
  const [lastSaved, setLastSaved] = useState<TaskRecord | undefined>(record);
  const [saveError, setSaveError] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>(() =>
    isNew ? { ...emptyTaskDraft(), text: nls.t('features.tasks.newTask') } : taskToDraft(base),
  );

  // Adopt external task changes for fields that are not locally edited.
  useEffect(() => {
    if (record === undefined || record === recordRef.current) {
      return;
    }
    const previous = recordRef.current;
    recordRef.current = record;
    savedRef.current = record;
    setLastSaved(record);
    const submittedRecord = submittedRecordRef.current;
    const confirms =
      submittedRecord !== undefined &&
      JSON.stringify(taskToDraft(record)) === JSON.stringify(taskToDraft(submittedRecord));
    const submitted = confirms ? submittedRef.current : undefined;
    if (confirms) {
      submittedRef.current = undefined;
      submittedRecordRef.current = undefined;
      submissionTokenRef.current = undefined;
    }
    // A confirming refresh may carry the value the user changed after the
    // write started; merge against the submitted draft, not the old record.
    const baseDraft = submitted ?? (previous !== undefined ? taskToDraft(previous) : taskToDraft(record));
    setDraft((current) => mergeTaskDraft(current, baseDraft, taskToDraft(record)));
  }, [record]);
  const invalidTimestamp = taskDraftHasInvalidTimestamp(draft);
  const targetId = lastSaved?.id ?? record?.id;
  const displayTitle = draft.text.trim() !== '' ? draft.text.trim() : isNew ? nls.t('features.tasks.newTask') : '—';

  const patch = (update: Partial<TaskDraft>) => {
    setSaveError(false);
    setDraft((current) => ({ ...current, ...update }));
  };

  const targetData = useMemo(
    () => ({
      persons,
      families,
      sources,
      places,
      repositories,
      titles,
      facts,
      citations,
      notes,
      media,
      submitters,
      addresses,
      associations,
      tasks,
    }),
    [
      persons,
      families,
      sources,
      places,
      repositories,
      titles,
      facts,
      citations,
      notes,
      media,
      submitters,
      addresses,
      associations,
      tasks,
    ],
  );

  const subtitleParts: string[] = [];
  if (draft.targetType !== '' && draft.targetId !== '') {
    subtitleParts.push(taskTargetLabel(draft.targetType, draft.targetId, targetData));
  }

  const save = async () => {
    setSaveError(false);
    if (draft.text.trim() === '' || invalidTimestamp) {
      throw new Error('The task text and timestamp must be valid before saving.');
    }
    const before = savedRef.current;
    const after = taskDraftToRecord(before, draft);
    try {
      if (isNew && lastSaved === undefined) {
        if (creatingRef.current) {
          return;
        }
        creatingRef.current = true;
        try {
          await api.addTask(after);
          onCreated(after.id);
          savedRef.current = after;
          setLastSaved(after);
        } finally {
          creatingRef.current = false;
        }
      } else {
        const submission = draft;
        const token = {};
        submissionTokenRef.current = token;
        submittedRef.current = submission;
        submittedRecordRef.current = undefined;
        try {
          await api.updateTask(before, after);
          if (submissionTokenRef.current === token) {
            submittedRecordRef.current = after;
            const currentBaseline = savedRef.current;
            if (
              currentBaseline === before ||
              JSON.stringify(taskToDraft(currentBaseline)) === JSON.stringify(taskToDraft(after))
            ) {
              savedRef.current = after;
              setLastSaved(after);
            }
          }
        } catch (error) {
          if (submissionTokenRef.current === token && submittedRef.current === submission) {
            submittedRef.current = undefined;
            submittedRecordRef.current = undefined;
          }
          throw error;
        }
      }
    } catch (error) {
      setSaveError(true);
      throw error;
    }
  };

  const autoSave = useAutoSaveOnBlur({
    enabled: !isNew,
    isDirty: () => {
      if (taskDraftHasInvalidTimestamp(draft)) {
        return true;
      }
      const persisted = savedRef.current;
      return JSON.stringify(taskDraftToRecord(persisted, draft)) !== JSON.stringify(persisted);
    },
    save,
  });

  const remove = async () => {
    const target = lastSaved ?? base;
    await api.deleteTask(target);
    autoSave.release();
    onClose();
  };

  return (
    <EntityTab onBlur={autoSave.onBlur}>
      <EntityViewCard
        media={<ListTodo size={20} aria-hidden="true" />}
        title={displayTitle}
        subtitle={subtitleParts.length > 0 ? subtitleParts.join(' · ') : null}
        actions={
          isNew ? (
            <Button
              variant="primary"
              size="sm"
              data-autosave-skip="true"
              disabled={draft.text.trim() === '' || invalidTimestamp}
              onClick={() => void save().catch(() => undefined)}
            >
              {nls.t('features.tree.create')}
            </Button>
          ) : undefined
        }
      />
      <AutoSaveError failed={autoSave.failed} retryDisabled={autoSave.pendingDelete} onRetry={autoSave.retry} />
      {isNew && saveError ? <InlineError>{nls.t('features.tree.autosaveFailed')}</InlineError> : null}

      <SectionCard title={nls.t('features.tree.details')}>
        <TaskEditorFields
          edit={draft}
          data={targetData}
          onChange={patch}
          targetTypes={VISIBLE_TARGET_TYPES}
          autoFocusText={isNew}
        />
      </SectionCard>
      {targetId !== undefined && (
        <AttachmentsPanel
          targetType="task"
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

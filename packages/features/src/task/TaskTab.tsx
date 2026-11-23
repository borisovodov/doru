import { useMemo, useState } from 'react';
import { Button, DangerZone, EntityViewCard, SectionCard, useAutoSaveOnBlur } from '@doru/ui';
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
  const [lastSaved, setLastSaved] = useState<TaskRecord | undefined>(record);
  const [draft, setDraft] = useState<TaskDraft>(() =>
    isNew ? { ...emptyTaskDraft(), text: nls.t('features.tasks.newTask') } : taskToDraft(base),
  );
  const invalidTimestamp = taskDraftHasInvalidTimestamp(draft);
  const targetId = lastSaved?.id ?? record?.id;
  const displayTitle = draft.text.trim() !== '' ? draft.text.trim() : isNew ? nls.t('features.tasks.newTask') : '—';

  const patch = (update: Partial<TaskDraft>) => setDraft((current) => ({ ...current, ...update }));

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
    if (draft.text.trim() === '' || invalidTimestamp) {
      throw new Error('The task text and timestamp must be valid before saving.');
    }
    const after = taskDraftToRecord(base, draft);
    if (isNew && lastSaved === undefined) {
      await api.addTask(after);
      onCreated(after.id);
    } else {
      await api.updateTask(lastSaved ?? base, after);
    }
    setLastSaved(after);
  };

  const autoSave = useAutoSaveOnBlur({
    enabled: !isNew,
    isDirty: () => {
      const persisted = lastSaved ?? record;
      return (
        persisted !== undefined && JSON.stringify(taskDraftToRecord(persisted, draft)) !== JSON.stringify(persisted)
      );
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
              onClick={() => void save()}
            >
              {nls.t('features.tree.create')}
            </Button>
          ) : undefined
        }
      />
      <AutoSaveError failed={autoSave.failed} retryDisabled={autoSave.pendingDelete} onRetry={autoSave.retry} />

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

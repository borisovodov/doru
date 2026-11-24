import { useEffect, useRef, useState } from 'react';
import type {
  CitationRecord,
  FactRecord,
  FamilyRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  TargetRef,
  TitleRecord,
} from '@doru/core';
import { TARGET_TYPES } from '@doru/core/model';
import { CitationAttachments, NoteAttachments, refreshAfterTagAttach, useAttachments } from '../attachments';
import { AutoSaveError } from '../autoSaveFeedback';
import { useEntityDelete } from '../entityDelete';
import { Button, DangerZone, InlineError, SectionCard, useAutoSaveOnBlur } from '@doru/ui';
import { MediaSection } from '../media/MediaSection';
import { EntityTab, SourceCitationsList } from '../sidebar';
import type { MediaTargetApi, SourceEditorApi } from '../person/types';
import { SourceEditor } from './SourceEditor';
import type { MediaWithPath } from '@doru/ui/domain';
import {
  ContributorsSection,
  IdentifiersSection,
  NotesSection,
  SourcesSection,
  TagsSection,
  TargetPicker,
  TasksSection,
  emptySourceDraft,
  mergeSourceDraft,
  sourceDraftMatches,
  sourceDraftToRecord,
  sourceToDraft,
  type SourceDraft,
} from '@doru/ui/domain';
import { nls } from '../nls';

/** A new source starts with the placeholder text as its editable default title. */
function newSourceDraft(): SourceDraft {
  return { ...emptySourceDraft(), title: nls.t('features.tree.source.newSource') };
}

/** A source citation may point at any record except a task. */
const SOURCE_TARGET_TYPES = TARGET_TYPES.filter((type) => type !== 'task');

export function SourceTab({
  entityId,
  sources,
  api,
  persons,
  families,
  facts,
  places,
  citations,
  notes,
  media,
  mediaApi,
  onOpenPerson,
  onOpenMedia,
  onOpenSource,
  onClose,
  onCreated,
}: {
  entityId: string;
  sources: SourceRecord[];
  api: SourceEditorApi;
  media: MediaWithPath[];
  mediaApi: MediaTargetApi;
  onOpenMedia: (mediaId: string) => void;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  places: PlaceRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  onOpenPerson: (personId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onClose: () => void;
  onCreated: (realId: string) => void;
}) {
  const sourceId = entityId;
  const isNew = sourceId.startsWith('new:');
  const record = sources.find((source) => source.id === sourceId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.sources.notFound')}</p>;
  }
  return (
    <SourceTabBody
      record={record}
      isNew={isNew}
      api={api}
      persons={persons}
      families={families}
      facts={facts}
      places={places}
      sources={sources}
      citations={citations}
      notes={notes}
      media={media}
      mediaApi={mediaApi}
      onOpenPerson={onOpenPerson}
      onOpenMedia={onOpenMedia}
      onOpenSource={onOpenSource}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function SourceTabBody({
  record,
  isNew,
  api,
  persons,
  families,
  facts,
  places,
  sources,
  media,
  mediaApi,
  onOpenMedia,
  citations,
  notes,
  onOpenPerson,
  onOpenSource,
  onClose,
  onCreated,
}: {
  record: SourceRecord | undefined;
  isNew: boolean;
  api: SourceEditorApi;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  places: PlaceRecord[];
  sources: SourceRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  media: MediaWithPath[];
  mediaApi: MediaTargetApi;
  onOpenMedia: (mediaId: string) => void;
  onOpenPerson: (personId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onClose: () => void;
  onCreated: (realId: string) => void;
}) {
  const [draft, setDraftState] = useState<SourceDraft>(() =>
    isNew ? newSourceDraft() : record ? sourceToDraft(record) : newSourceDraft(),
  );
  const [lastSaved, setLastSaved] = useState<SourceRecord | undefined>(record);
  const [saveError, setSaveError] = useState(false);
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [titles, setTitles] = useState<TitleRecord[]>([]);
  const [linkTargets, setLinkTargets] = useState<TargetRef[]>([]);
  const [linkError, setLinkError] = useState(false);
  const [citationError, setCitationError] = useState(false);
  const recordRef = useRef(record);
  const draftRef = useRef(draft);
  const baselineRef = useRef(record);
  const submittedRef = useRef<SourceDraft | undefined>(undefined);
  const refreshBaselineRef = useRef<SourceDraft | undefined>(undefined);
  const submissionOriginRef = useRef<SourceDraft | undefined>(undefined);
  const savingRef = useRef(false);
  const setDraft = (next: SourceDraft) => {
    draftRef.current = next;
    setDraftState(next);
  };

  const currentSource = lastSaved ?? record;
  const targetId = currentSource?.id;
  const attachSourceToTargets = api.attachSourceToTargets;
  const {
    notes: sourceNotes,
    allNotes,
    citations: sourceCitations,
    tags,
    tagLinks,
    identifiers,
    submitters,
    contributors,
    refresh: refreshAttachments,
  } = useAttachments('source', targetId, api, true);

  // Reset the draft only when it still equals the previous stored source —
  // i.e. the user has no unsaved edits. Unrelated tree reloads must not
  // clobber in-progress edits.
  useEffect(() => {
    if (isNew || record === undefined || record === recordRef.current) {
      return;
    }
    const previous = recordRef.current;
    recordRef.current = record;
    baselineRef.current = record;
    setLastSaved(record);
    const submitted = submittedRef.current;
    if (submitted !== undefined && sourceDraftMatches(submitted, record)) {
      // This is the acknowledgement of our own save. If the user edited the
      // draft after Save started, merge against the submitted values so the
      // newer edit survives even when it restores the old value.
      submittedRef.current = undefined;
      refreshBaselineRef.current = undefined;
      submissionOriginRef.current = undefined;
      setDraft(
        JSON.stringify(draftRef.current) === JSON.stringify(submitted)
          ? sourceToDraft(record)
          : mergeSourceDraft(draftRef.current, submitted, sourceToDraft(record)),
      );
      return;
    }
    if (submitted !== undefined) {
      // A save is still in flight. Keep every field the submitted draft
      // changed, plus every post-submission edit, and take refreshed values
      // only for fields that stayed exactly as submitted.
      const draft = draftRef.current;
      const refreshed = sourceToDraft(record);
      if (previous === undefined) {
        setDraft(draft);
      } else {
        const previousDraft = submissionOriginRef.current ?? sourceToDraft(previous);
        const baseline = refreshBaselineRef.current ?? submitted;
        const nextBaseline: SourceDraft = { ...baseline };
        const merged: SourceDraft = { ...draft };
        const changedInSubmission = (key: keyof SourceDraft): boolean =>
          JSON.stringify(submitted[key]) !== JSON.stringify(previousDraft[key]);
        const editedSinceBaseline = (key: keyof SourceDraft): boolean =>
          JSON.stringify(draft[key]) !== JSON.stringify(baseline[key]);
        for (const key of Object.keys(refreshed) as Array<keyof SourceDraft>) {
          if (key === 'id' || Array.isArray(refreshed[key])) {
            continue;
          }
          if (!changedInSubmission(key) && !editedSinceBaseline(key)) {
            (merged as unknown as Record<string, unknown>)[key] = refreshed[key];
            (nextBaseline as unknown as Record<string, unknown>)[key] = refreshed[key];
          }
        }
        for (const key of ['texts', 'dataEvents', 'repositories', 'templateFields'] as const) {
          if (!changedInSubmission(key) && !editedSinceBaseline(key)) {
            (merged as unknown as Record<string, unknown>)[key] = refreshed[key];
            (nextBaseline as unknown as Record<string, unknown>)[key] = refreshed[key];
          } else {
            (merged as unknown as Record<string, unknown>)[key] = mergeSourceDraft(draft, previousDraft, refreshed)[
              key
            ];
          }
        }
        refreshBaselineRef.current = nextBaseline;
        setDraft(merged);
      }
    } else if (previous !== undefined) {
      if (sourceDraftMatches(draftRef.current, previous)) {
        setDraft(sourceToDraft(record));
      } else {
        setDraft(mergeSourceDraft(draftRef.current, sourceToDraft(previous), sourceToDraft(record)));
      }
    }
  }, [record, isNew]);

  useEffect(() => {
    let cancelled = false;
    void api.getRepositories().then((loaded) => {
      if (!cancelled) setRepositories(loaded);
    });
    void api.getTitles().then((loaded) => {
      if (!cancelled) setTitles(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [api, record]);

  const save = async () => {
    if (savingRef.current) {
      return;
    }
    setSaveError(false);
    savingRef.current = true;
    try {
      const target = lastSaved ?? record;
      const recordAtStart = recordRef.current;
      const next = sourceDraftToRecord(draftRef.current, lastSaved ?? record ?? baselineRef.current);
      const submission = sourceToDraft(next);
      submittedRef.current = submission;
      refreshBaselineRef.current = submission;
      submissionOriginRef.current =
        baselineRef.current !== undefined ? sourceToDraft(baselineRef.current) : newSourceDraft();
      try {
        if (isNew && lastSaved === undefined) {
          await api.addSource(next);
          onCreated(next.id);
        } else {
          if (target === undefined) {
            return;
          }
          await api.updateSource(target, next);
        }
      } catch (error) {
        setSaveError(true);
        if (submittedRef.current === submission) {
          submittedRef.current = undefined;
          refreshBaselineRef.current = undefined;
          submissionOriginRef.current = undefined;
        }
        throw error;
      }
      const current = recordRef.current;
      const currentMatchesStart =
        current !== undefined &&
        recordAtStart !== undefined &&
        sourceDraftMatches(sourceToDraft(current), recordAtStart);
      const currentMatchesWritten = current !== undefined && sourceDraftMatches(sourceToDraft(current), next);
      if (current === recordAtStart || currentMatchesStart || currentMatchesWritten) {
        baselineRef.current = next;
        setLastSaved(next);
      }
    } finally {
      savingRef.current = false;
    }
  };

  const autoSave = useAutoSaveOnBlur({
    enabled: !isNew,
    isDirty: () => {
      const persisted = lastSaved ?? record;
      if (persisted === undefined) {
        return false;
      }
      // Compare stored values, not raw input: trailing spaces must not trigger
      // an autosave when the saved record would be unchanged.
      const normalized = sourceToDraft(sourceDraftToRecord(draft, persisted));
      return !sourceDraftMatches(normalized, persisted);
    },
    save,
  });

  const remove = async () => {
    const target = lastSaved ?? record;
    if (target) {
      await api.deleteSource(target);
    }
  };

  const deletion = useEntityDelete(autoSave, remove, onClose);

  return (
    <EntityTab>
      <SourceEditor
        draft={draft}
        isNew={isNew}
        onBlur={autoSave.onBlur}
        notice={
          <>
            <AutoSaveError failed={autoSave.failed} retryDisabled={autoSave.pendingDelete} onRetry={autoSave.retry} />
            {isNew && saveError ? <InlineError>{nls.t('features.tree.autosaveFailed')}</InlineError> : null}
            {deletion.failed ? <InlineError>{nls.t('features.tree.deleteFailed')}</InlineError> : null}
          </>
        }
        onChange={(next) => {
          setSaveError(false);
          setDraft(next);
        }}
        repositories={repositories}
        titles={titles}
        places={places}
        onAddRepository={async (repository) => {
          await api.addRepository(repository);
          setRepositories(await api.getRepositories());
        }}
        onSave={() => void save().catch(() => undefined)}
      />
      {currentSource !== undefined && (
        <>
          {citationError ? <InlineError>{nls.t('features.tree.autosaveFailed')}</InlineError> : null}
          <SourceCitationsList
            source={currentSource}
            persons={persons}
            families={families}
            facts={facts}
            citations={citations}
            notes={notes}
            onOpenPerson={onOpenPerson}
            onDetachCitation={(citationId) => {
              setCitationError(false);
              void api.detachCitation(citationId).catch(() => setCitationError(true));
            }}
          />
          {attachSourceToTargets !== undefined && (
            <SectionCard title={nls.t('features.tasks.target')}>
              <TargetPicker
                allowedTypes={SOURCE_TARGET_TYPES}
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
                  void attachSourceToTargets(currentSource.id, submitted)
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
                {nls.t('features.tree.sources.attach')}
              </Button>
              {linkError ? <InlineError>{nls.t('features.tree.autosaveFailed')}</InlineError> : null}
            </SectionCard>
          )}
          {targetId !== undefined && (
            <>
              <SourcesSection
                targetType="source"
                targetId={targetId}
                sources={sources}
                citations={sourceCitations}
                refresh={refreshAttachments}
                onAddSource={api.addSource}
                onAddSourceToTargets={api.addSourceToTargets}
                onAttachSource={api.attachSource}
                onAttachSourceToTargets={api.attachSourceToTargets}
                onDetachCitation={api.detachCitation}
                onUpdateCitation={api.updateCitation}
                onOpenSource={onOpenSource}
                renderCitationAttachments={(citation) => (
                  <CitationAttachments citation={citation} api={api} sources={sources} onOpenSource={onOpenSource} />
                )}
              />
              <NotesSection
                targetType="source"
                targetId={targetId}
                notes={sourceNotes}
                availableNotes={allNotes}
                onAdd={async (text) => {
                  await api.addNote({ id: crypto.randomUUID(), text, targetType: 'source', targetId });
                  await refreshAttachments();
                }}
                onUpdate={async (before, after, context) => {
                  await api.updateNote(before, after, context);
                  await refreshAttachments();
                }}
                onAttach={async (noteId) => {
                  await api.attachNote(noteId, { id: crypto.randomUUID(), targetType: 'source', targetId });
                  await refreshAttachments();
                }}
                onDetach={async (note, link) => {
                  await api.detachNote(note, link);
                  await refreshAttachments();
                }}
                onDelete={async (note) => {
                  await api.deleteNote(note);
                  await refreshAttachments();
                }}
                renderAttachments={(note) => (
                  <NoteAttachments note={note} api={api} sources={sources} onOpenSource={onOpenSource} />
                )}
              />
              <IdentifiersSection
                targetType="source"
                targetId={targetId}
                identifiers={identifiers}
                onAdd={async (identifier) => {
                  await api.addIdentifier(identifier);
                  await refreshAttachments();
                }}
                onUpdate={async (before, after) => {
                  await api.updateIdentifier(before, after);
                  await refreshAttachments();
                }}
                onDelete={async (identifier) => {
                  await api.deleteIdentifier(identifier);
                  await refreshAttachments();
                }}
              />
              <TagsSection
                targetType="source"
                targetId={targetId}
                tags={tags}
                tagLinks={tagLinks}
                onAddTag={api.addTag}
                onUpdateTag={api.updateTag}
                onDeleteTag={api.deleteTag}
                onAttachTagToTargets={refreshAfterTagAttach(api.attachTagToTargets, refreshAttachments)}
                onAttachTag={async (link) => {
                  await api.attachTag(link);
                  await refreshAttachments();
                }}
                onDetachTag={async (link) => {
                  await api.detachTag(link);
                  await refreshAttachments();
                }}
              />
              <MediaSection
                targetType="source"
                targetId={targetId}
                media={media.filter((item) =>
                  item.links?.some((link) => link.targetType === 'source' && link.targetId === targetId),
                )}
                api={mediaApi}
                refresh={async () => undefined}
                onOpenMedia={onOpenMedia}
              />
              <ContributorsSection
                targetType="source"
                targetId={targetId}
                submitters={submitters}
                links={contributors}
                onAdd={api.addRecordSubmitter}
                onDelete={api.deleteRecordSubmitter}
              />
              <TasksSection targetType="source" targetId={targetId} api={api} />
            </>
          )}
        </>
      )}
      {(!isNew || lastSaved !== undefined) && (
        <DangerZone>
          <Button
            variant="danger"
            size="sm"
            data-autosave-skip="true"
            disabled={deletion.deleting}
            onClick={deletion.deleteEntity}
          >
            {nls.t('features.tree.fact.delete')}
          </Button>
        </DangerZone>
      )}
    </EntityTab>
  );
}

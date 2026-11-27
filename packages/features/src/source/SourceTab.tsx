import { useEffect, useMemo, useRef, useState } from 'react';
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
import { CITATION_TARGET_TYPES } from '@doru/core/model';
import { CitationAttachments, useAttachments } from '../attachments';
import { AutoSaveError } from '../autoSaveFeedback';
import { useEntityDelete } from '../entityDelete';
import { Button, DangerZone, InlineError, SectionCard, useAutoSaveOnBlur } from '@doru/ui';
import { MediaSection } from '../media/MediaSection';
import { EntityTab, SourceCitationsList } from '../sidebar';
import type { MediaTargetApi, SourceEditorApi } from '../person/types';
import { SourceEditor } from './SourceEditor';
import type { MediaWithPath } from '@doru/ui/domain';
import {
  NotesSection,
  SourcesSection,
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
  const [linkError, setLinkError] = useState(false);
  const [linkPending, setLinkPending] = useState(false);
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
  const [committedTargets, setCommittedTargets] = useState<{
    targets: TargetRef[];
    citations: readonly CitationRecord[];
  } | null>(null);
  const citationTargets = useMemo(() => {
    if (targetId === undefined) {
      return [];
    }
    const seen = new Set<string>();
    const targets: TargetRef[] = [];
    for (const citation of citations) {
      if (citation.sourceId !== targetId) {
        continue;
      }
      const key = `${citation.targetType}\u0000${citation.targetId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      targets.push({ targetType: citation.targetType, targetId: citation.targetId });
    }
    return targets;
  }, [citations, targetId]);
  const relatedTargets =
    committedTargets !== null && committedTargets.citations === citations ? committedTargets.targets : citationTargets;
  const {
    notes: sourceNotes,
    citations: sourceCitations,
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

  const updateRelatedTargets = (next: TargetRef[]) => {
    if (linkPending || currentSource === undefined || attachSourceToTargets === undefined) {
      return;
    }
    const key = (target: TargetRef) => `${target.targetType}\u0000${target.targetId}`;
    const currentKeys = new Set(relatedTargets.map(key));
    const nextKeys = new Set(next.map(key));
    const added = next.filter((target) => !currentKeys.has(key(target)));
    const removed = relatedTargets.filter((target) => !nextKeys.has(key(target)));
    if (added.length === 0 && removed.length === 0) {
      return;
    }
    setLinkError(false);
    setLinkPending(true);
    // TODO(citations): a Related to chip is per target, but GEDCOM allows
    // several citations from one source to the same target with different
    // page/quality metadata. Removing the chip currently detaches all of
    // them; revisit this together with the citations/sources UI instead of
    // treating the target-level removal as final.
    const detach = removed.flatMap((target) =>
      citations
        .filter(
          (citation) =>
            citation.sourceId === currentSource.id &&
            citation.targetType === target.targetType &&
            citation.targetId === target.targetId,
        )
        .map((citation) => api.detachCitation(citation.id)),
    );
    void (added.length > 0 ? attachSourceToTargets(currentSource.id, added) : Promise.resolve())
      .then(() => Promise.all(detach))
      .then(() => setCommittedTargets({ targets: next, citations }))
      .catch(() => setLinkError(true))
      .finally(() => setLinkPending(false));
  };

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
          {targetId !== undefined && (
            <>
              <SourcesSection
                targetType="source"
                targetId={targetId}
                sources={sources}
                citations={sourceCitations}
                refresh={refreshAttachments}
                onAddSource={api.addSource}
                onAttachSource={api.attachSource}
                onDetachCitation={api.detachCitation}
                onUpdateCitation={api.updateCitation}
                onOpenSource={onOpenSource}
                renderCitationAttachments={(citation) => (
                  <CitationAttachments citation={citation} api={api} sources={sources} onOpenSource={onOpenSource} />
                )}
              />
              <NotesSection
                notes={sourceNotes}
                onAdd={async (text) => {
                  await api.addNote({ id: crypto.randomUUID(), text, targetType: 'source', targetId });
                  await refreshAttachments();
                }}
                onUpdate={async (before, after) => {
                  await api.updateNote(before, after);
                  await refreshAttachments();
                }}
                onDelete={async (note) => {
                  await api.deleteNote(note);
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
              <TasksSection targetType="source" targetId={targetId} api={api} />
            </>
          )}
          {attachSourceToTargets !== undefined && (
            <SectionCard title={nls.t('features.tasks.target')}>
              <TargetPicker
                allowedTypes={CITATION_TARGET_TYPES}
                value={relatedTargets}
                onChange={updateRelatedTargets}
                disabled={linkPending}
                ariaLabel={nls.t('features.tasks.target')}
              />
              {linkError ? <InlineError>{nls.t('features.tree.autosaveFailed')}</InlineError> : null}
            </SectionCard>
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

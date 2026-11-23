import { useEffect, useMemo, useRef, useState } from 'react';
import type { AssociationRecord, FamilyRecord, PersonRecord, SourceRecord } from '@doru/core';
import { AttachmentsPanel, CitationAttachments, NoteAttachments, useAttachments } from '../attachments';
import { MediaSection } from '../media/MediaSection';
import { EntityTab } from '../sidebar';
import type { FamilyEditorApi, MediaTargetApi } from '../person/types';
import { FamilyEditor } from './FamilyEditor';
import { AutoSaveError } from '../autoSaveFeedback';
import { useEntityDelete } from '../entityDelete';
import { Button, DangerZone, InlineError, useAutoSaveOnBlur } from '@doru/ui';
import type { MediaWithPath } from '@doru/ui/domain';
import {
  ContactsSection,
  ContributorsSection,
  IdentifiersSection,
  NotesSection,
  RestrictionsSection,
  SourcesSection,
  TagsSection,
  TasksSection,
  familyDraftMatches,
  familyDraftToRecord,
  familyToDraft,
  type FamilyDraft,
} from '@doru/ui/domain';
import { nls } from '../nls';

/**
 * Keeps fields edited after submission, accepts refreshed values for the rest.
 * `protectedDraft` marks fields touched by an in-flight write: those always
 * keep the current (possibly reverted) value until the write is confirmed.
 * Protection compares against the submission's own baseline, not the latest
 * previous record, so an unchanged submitted value does not become a change
 * merely because another writer refreshed it.
 */
function familyRowTouched<T>(row: T | undefined, base: T | undefined): boolean {
  if (row === undefined || row === null || base === undefined || base === null) {
    return false;
  }
  return (Object.keys(row) as Array<keyof T>).some((key) => JSON.stringify(row[key]) !== JSON.stringify(base[key]));
}

function mergeFamilyRow<T extends { id: string }>(
  draft: T,
  base: T,
  refreshed: T,
  protectedRow?: T,
  protectedBaseRow?: T,
): T {
  const merged: T = { ...refreshed };
  for (const key of Object.keys(draft) as Array<keyof T>) {
    const touchedBySubmission =
      protectedRow !== undefined &&
      protectedBaseRow !== undefined &&
      JSON.stringify(protectedRow[key]) !== JSON.stringify(protectedBaseRow[key]);
    if (touchedBySubmission || JSON.stringify(draft[key]) !== JSON.stringify(base[key])) {
      merged[key] = draft[key];
    }
  }
  return merged;
}

function familyOrderWithAdditions<T extends { id: string }>(
  rows: T[],
  baseRows: T[],
  keyOf: (row: T) => string,
): string[] {
  const rowKeys = rows.map(keyOf);
  const baseKeys = new Set(baseRows.map(keyOf));
  const expected = baseRows.map(keyOf).filter((key) => rowKeys.includes(key));
  expected.push(...rowKeys.filter((key) => !baseKeys.has(key)));
  return rowKeys.join('\u0000') === expected.join('\u0000') ? [] : rowKeys;
}

function mergeFamilyRows<T extends { id: string }>(
  draftRows: T[],
  baseRows: T[],
  refreshedRows: T[],
  protectedRows?: T[],
  protectedBaseRows?: T[],
  matchKey?: (row: T) => string,
): T[] {
  const keyOf = matchKey ?? ((row: T) => row.id);
  const baseById = new Map(baseRows.map((row) => [keyOf(row), row]));
  const refreshedById = new Map(refreshedRows.map((row) => [keyOf(row), row]));
  const protectedById = new Map((protectedRows ?? []).map((row) => [keyOf(row), row]));
  const protectedBaseById = new Map((protectedBaseRows ?? []).map((row) => [keyOf(row), row]));
  const draftKeys = new Set(draftRows.map(keyOf));
  const draftReordered = familyOrderWithAdditions(draftRows, baseRows, keyOf).length > 0;
  const submissionReordered =
    protectedRows !== undefined &&
    protectedBaseRows !== undefined &&
    familyOrderWithAdditions(protectedRows, protectedBaseRows, keyOf).length > 0;
  const orderChanged = draftReordered || submissionReordered;
  const merged: T[] = [];
  for (const row of draftRows) {
    const base = baseById.get(keyOf(row));
    const refreshed = refreshedById.get(keyOf(row));
    const protectedRow = protectedById.get(keyOf(row));
    const protectedBaseRow = protectedBaseById.get(keyOf(row));
    if (base === undefined) {
      merged.push(row);
      continue;
    }
    if (!familyRowTouched(protectedRow, protectedBaseRow) && JSON.stringify(row) === JSON.stringify(base)) {
      if (refreshed !== undefined) {
        merged.push(refreshed);
      }
      continue;
    }
    if (refreshed === undefined) {
      merged.push(row);
      continue;
    }
    merged.push(mergeFamilyRow(row, base, refreshed, protectedRow, protectedBaseRow));
  }
  for (const row of refreshedRows) {
    const key = keyOf(row);
    if (!draftKeys.has(key) && !baseById.has(key) && !protectedById.has(key)) {
      merged.push(row);
    }
  }
  if (orderChanged) {
    return merged;
  }
  const mergedById = new Map(merged.map((row) => [keyOf(row), row]));
  const ordered: T[] = [];
  for (const row of refreshedRows) {
    const key = keyOf(row);
    const mergedRow = mergedById.get(key);
    if (mergedRow !== undefined) {
      ordered.push(mergedRow);
      mergedById.delete(key);
    }
  }
  for (const row of merged) {
    const key = keyOf(row);
    const remaining = mergedById.get(key);
    if (remaining !== undefined) {
      ordered.push(remaining);
      mergedById.delete(key);
    }
  }
  return ordered;
}

export function mergeFamilyDraft(
  current: FamilyDraft,
  base: FamilyDraft,
  refreshed: FamilyDraft,
  protectedDraft?: FamilyDraft,
  protectedBase?: FamilyDraft,
): FamilyDraft {
  const field = <K extends keyof FamilyDraft>(key: K): FamilyDraft[K] => {
    if (
      protectedDraft !== undefined &&
      JSON.stringify(protectedDraft[key]) !== JSON.stringify((protectedBase ?? base)[key])
    ) {
      return current[key];
    }
    return JSON.stringify(current[key]) === JSON.stringify(base[key]) ? refreshed[key] : current[key];
  };
  const marriageStatuses = mergeFamilyRows(
    current.marriageStatuses,
    base.marriageStatuses,
    refreshed.marriageStatuses,
    protectedDraft?.marriageStatuses,
    protectedBase?.marriageStatuses,
  );
  const partnerLinks = mergeFamilyRows(
    current.partnerLinks,
    base.partnerLinks,
    refreshed.partnerLinks,
    protectedDraft?.partnerLinks,
    protectedBase?.partnerLinks,
    (row) => row.personId,
  );
  const childLinks = mergeFamilyRows(
    current.childLinks,
    base.childLinks,
    refreshed.childLinks,
    protectedDraft?.childLinks,
    protectedBase?.childLinks,
    (row) => row.childId,
  );
  return {
    id: current.id,
    xref: field('xref'),
    preferred: field('preferred'),
    sameSex: field('sameSex'),
    unionKind: field('unionKind'),
    unionStatus: field('unionStatus'),
    marriageBeginStatus: field('marriageBeginStatus'),
    marriageEndStatus: field('marriageEndStatus'),
    witnesses: field('witnesses'),
    marriageStatuses,
    partnerLinks,
    childLinks,
  };
}

export function FamilyTab({
  entityId,
  families,
  api,
  persons,
  associations,
  sources,
  media,
  mediaApi,
  onOpenMedia,
  onOpenSource,
  onClose,
}: {
  entityId: string;
  families: FamilyRecord[];
  api: FamilyEditorApi;
  persons: PersonRecord[];
  associations: AssociationRecord[];
  sources: SourceRecord[];
  media: MediaWithPath[];
  mediaApi: MediaTargetApi;
  onOpenMedia: (mediaId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onClose: () => void;
}) {
  const familyId = entityId;
  const record = families.find((family) => family.id === familyId);
  if (!record) {
    return <p className="person-missing">{nls.t('features.tree.familyNotFound')}</p>;
  }
  return (
    <FamilyTabBody
      record={record}
      families={families}
      api={api}
      persons={persons}
      associations={associations}
      sources={sources}
      media={media}
      mediaApi={mediaApi}
      onOpenMedia={onOpenMedia}
      onOpenSource={onOpenSource}
      onClose={onClose}
    />
  );
}

function FamilyTabBody({
  record,
  families,
  api,
  persons,
  associations,
  sources,
  media,
  mediaApi,
  onOpenMedia,
  onOpenSource,
  onClose,
}: {
  record: FamilyRecord;
  families: FamilyRecord[];
  api: FamilyEditorApi;
  persons: PersonRecord[];
  associations: AssociationRecord[];
  sources: SourceRecord[];
  media: MediaWithPath[];
  mediaApi: MediaTargetApi;
  onOpenMedia: (mediaId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FamilyDraft>(() => familyToDraft(record));
  const familyAssociations = useMemo(
    () => associations.filter((association) => association.familyId === record.id),
    [associations, record.id],
  );
  const {
    notes: familyNotes,
    allNotes,
    citations: familyCitations,
    tags,
    tagLinks,
    identifiers,
    contacts,
    restrictions,
    submitters,
    contributors,
    refresh: refreshAttachments,
  } = useAttachments('family', record.id, api, true);
  const recordRef = useRef(record);
  const savedRef = useRef(record);
  const submittedRef = useRef<FamilyDraft | undefined>(undefined);
  const submittedBaselineRef = useRef<FamilyDraft | undefined>(undefined);

  // Reset the draft only when it still equals the previous stored family —
  // i.e. the user has no unsaved edits. A refresh that arrives while a write
  // is pending is merged against the submitted draft so edits made after the
  // submission survive.
  useEffect(() => {
    if (record === recordRef.current) {
      return;
    }
    const previous = recordRef.current;
    recordRef.current = record;
    savedRef.current = record;
    const submitted = submittedRef.current;
    const normalizedSubmitted =
      submitted !== undefined ? familyToDraft(familyDraftToRecord(submitted, previous)) : undefined;
    const confirmed = normalizedSubmitted !== undefined && familyDraftMatches(normalizedSubmitted, record);
    if (confirmed) {
      submittedRef.current = undefined;
      submittedBaselineRef.current = undefined;
    }
    // Only a record that confirms the pending write may use the submitted
    // draft as its base; an unrelated refresh must compare against the
    // previous stored snapshot.
    const base = normalizedSubmitted !== undefined && confirmed ? normalizedSubmitted : familyToDraft(previous);
    const protectedDraft = normalizedSubmitted !== undefined && !confirmed ? normalizedSubmitted : undefined;
    const protectedBase = protectedDraft !== undefined ? submittedBaselineRef.current : undefined;
    setDraft((current) => {
      if (submitted === undefined && familyDraftMatches(current, previous)) {
        return familyToDraft(record);
      }
      return mergeFamilyDraft(current, base, familyToDraft(record), protectedDraft, protectedBase);
    });
  }, [record]);

  const save = async () => {
    const base = savedRef.current;
    const submission = draft;
    const next = familyDraftToRecord(submission, base);
    submittedRef.current = submission;
    submittedBaselineRef.current = familyToDraft(base);
    try {
      await api.updateFamily(base, next);
      if (savedRef.current === base) {
        savedRef.current = next;
      }
    } catch (error) {
      if (submittedRef.current === submission) {
        submittedRef.current = undefined;
        submittedBaselineRef.current = undefined;
      }
      throw error;
    }
  };

  const autoSave = useAutoSaveOnBlur({
    enabled: true,
    isDirty: () => !familyDraftMatches(familyToDraft(familyDraftToRecord(draft, savedRef.current)), savedRef.current),
    save,
  });

  const remove = async () => {
    await api.deleteFamily(savedRef.current);
  };

  const deletion = useEntityDelete(autoSave, remove, onClose);

  return (
    <EntityTab>
      <FamilyEditor
        draft={draft}
        onBlur={autoSave.onBlur}
        notice={
          <>
            <AutoSaveError failed={autoSave.failed} retryDisabled={autoSave.pendingDelete} onRetry={autoSave.retry} />
            {deletion.failed ? <InlineError>{nls.t('features.tree.deleteFailed')}</InlineError> : null}
          </>
        }
        onChange={setDraft}
        onRowsChanged={autoSave.saveSoon}
        persons={persons}
        families={families}
        associations={familyAssociations}
        sources={sources}
        api={api}
        savedLinkIds={
          new Set([
            ...(record.partnerLinks ?? []).map((link) => link.id),
            ...(record.childLinks ?? []).map((link) => link.id),
          ])
        }
        renderStatusAttachments={(statusId) => (
          <AttachmentsPanel
            targetType="family_marriage_status"
            targetId={statusId}
            api={api}
            sources={sources}
            onOpenSource={onOpenSource}
          />
        )}
        renderLinkAttachments={(kind, linkId) => (
          <AttachmentsPanel
            targetType={kind === 'partner' ? 'family_partner' : 'family_child'}
            targetId={linkId}
            api={api}
            sources={sources}
            onOpenSource={onOpenSource}
          />
        )}
        onOpenSource={onOpenSource}
      />
      <SourcesSection
        targetType="family"
        targetId={record.id}
        sources={sources}
        citations={familyCitations}
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
        targetType="family"
        targetId={record.id}
        notes={familyNotes}
        availableNotes={allNotes}
        onAdd={async (text) => {
          await api.addNote({ id: crypto.randomUUID(), text, targetType: 'family', targetId: record.id });
          await refreshAttachments();
        }}
        onUpdate={async (before, after, context) => {
          await api.updateNote(before, after, context);
          await refreshAttachments();
        }}
        onAttach={async (noteId) => {
          await api.attachNote(noteId, { id: crypto.randomUUID(), targetType: 'family', targetId: record.id });
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
        targetType="family"
        targetId={record.id}
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
      <ContactsSection
        targetType="family"
        targetId={record.id}
        contacts={contacts}
        onAdd={async (contact) => {
          await api.addContact(contact);
          await refreshAttachments();
        }}
        onUpdate={async (before, after) => {
          await api.updateContact(before, after);
          await refreshAttachments();
        }}
        onDelete={async (contact) => {
          await api.deleteContact(contact);
          await refreshAttachments();
        }}
      />
      <RestrictionsSection
        targetType="family"
        targetId={record.id}
        restrictions={restrictions}
        onAdd={async (restriction) => {
          await api.addRestriction(restriction);
          await refreshAttachments();
        }}
        onUpdate={async (before, after) => {
          await api.updateRestriction(before, after);
          await refreshAttachments();
        }}
        onDelete={async (restriction) => {
          await api.deleteRestriction(restriction);
          await refreshAttachments();
        }}
      />
      <TagsSection
        targetType="family"
        targetId={record.id}
        tags={tags}
        tagLinks={tagLinks}
        onAddTag={api.addTag}
        onUpdateTag={api.updateTag}
        onDeleteTag={api.deleteTag}
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
        targetType="family"
        targetId={record.id}
        media={media.filter((item) =>
          item.links?.some((link) => link.targetType === 'family' && link.targetId === record.id),
        )}
        api={mediaApi}
        refresh={async () => undefined}
        onOpenMedia={onOpenMedia}
      />
      <ContributorsSection
        targetType="family"
        targetId={record.id}
        submitters={submitters}
        links={contributors}
        onAdd={api.addRecordSubmitter}
        onDelete={api.deleteRecordSubmitter}
      />
      <TasksSection targetType="family" targetId={record.id} api={api} />
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
    </EntityTab>
  );
}

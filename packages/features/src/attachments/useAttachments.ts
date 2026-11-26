import { useCallback, useEffect, useState } from 'react';
import type { CitationRecord, ContactRecord, NoteRecord, RecordSubmitterLink, SubmitterRecord } from '@doru/core';

/** The read methods every entity editor needs for its attachment sections. */
export interface AttachmentApi {
  getNotes(targetType: string, targetId: string): Promise<NoteRecord[]>;
  getAllNotes(): Promise<NoteRecord[]>;
  getCitations(targetType: string, targetId: string): Promise<CitationRecord[]>;
  getContacts(targetType: string, targetId: string): Promise<ContactRecord[]>;
}

/** The read and write contract every editor with contributors shares. */
export interface ContributorApi {
  getSubmitters(): Promise<SubmitterRecord[]>;
  getRecordSubmitters(targetType: string, targetId: string): Promise<RecordSubmitterLink[]>;
  addRecordSubmitter(
    submitterId: string,
    targetType: string,
    targetId: string,
    kind?: RecordSubmitterLink['kind'],
  ): Promise<void>;
  deleteRecordSubmitter(
    id: string,
    submitterId: string,
    targetType: string,
    targetId: string,
    kind?: RecordSubmitterLink['kind'],
  ): Promise<void>;
}

/** The extra methods needed by tabs that render the contributors section. */
export interface SubmitterAttachmentApi extends AttachmentApi, ContributorApi {}

export interface AttachmentData {
  notes: NoteRecord[];
  allNotes: NoteRecord[];
  citations: CitationRecord[];
  contacts: ContactRecord[];
  submitters: SubmitterRecord[];
  contributors: RecordSubmitterLink[];
}

const emptyAttachments = (): AttachmentData => ({
  notes: [],
  allNotes: [],
  citations: [],
  contacts: [],
  submitters: [],
  contributors: [],
});

/**
 * Loads the attachment lists of one entity. The loader itself is pure (it
 * only returns data); the effect commits it through a promise callback, so
 * the React Compiler's synchronous-setState-in-effect rule stays satisfied.
 * `refresh` is for mutation callbacks, not for effects.
 */
export function useAttachments(
  targetType: string,
  targetId: string | undefined,
  api: SubmitterAttachmentApi,
  withSubmitters: true,
): AttachmentData & { refresh: () => Promise<void> };
export function useAttachments(
  targetType: string,
  targetId: string | undefined,
  api: AttachmentApi,
  withSubmitters?: false,
): AttachmentData & { refresh: () => Promise<void> };
export function useAttachments(
  targetType: string,
  targetId: string | undefined,
  api: AttachmentApi,
  withSubmitters = false,
): AttachmentData & { refresh: () => Promise<void> } {
  const [data, setData] = useState<AttachmentData>(emptyAttachments);

  const load = useCallback(async (): Promise<AttachmentData> => {
    if (targetId === undefined) {
      return emptyAttachments();
    }
    const [notes, allNotes, citations, contacts] = await Promise.all([
      api.getNotes(targetType, targetId),
      api.getAllNotes(),
      api.getCitations(targetType, targetId),
      api.getContacts(targetType, targetId),
    ]);
    if (!withSubmitters) {
      return {
        ...emptyAttachments(),
        notes,
        allNotes,
        citations,
        contacts,
      };
    }
    const submitterApi = api as SubmitterAttachmentApi;
    const [submitters, contributors] = await Promise.all([
      submitterApi.getSubmitters(),
      submitterApi.getRecordSubmitters(targetType, targetId),
    ]);
    return {
      notes,
      allNotes,
      citations,
      contacts,
      submitters,
      contributors,
    };
  }, [targetType, targetId, api, withSubmitters]);

  useEffect(() => {
    let cancelled = false;
    void load().then((loaded) => {
      if (!cancelled) {
        setData(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setData(await load());
  }, [load]);

  return { ...data, refresh };
}

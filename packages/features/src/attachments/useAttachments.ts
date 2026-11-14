import { useCallback, useEffect, useState } from 'react';
import type {
  ChangeRecord,
  CitationRecord,
  ContactRecord,
  IdentifierRecord,
  NoteRecord,
  RestrictionRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
} from '@doru/core';

/** The read methods every entity editor needs for its attachment sections. */
export interface AttachmentApi {
  getNotes(targetType: string, targetId: string): Promise<NoteRecord[]>;
  getAllNotes(): Promise<NoteRecord[]>;
  getCitations(targetType: string, targetId: string): Promise<CitationRecord[]>;
  getTags(): Promise<TagRecord[]>;
  getTagLinks(targetType: string, targetId: string): Promise<Array<{ tagId: string; link: TagLinkRecord }>>;
  getIdentifiers(targetType: string, targetId: string): Promise<IdentifierRecord[]>;
  getContacts(targetType: string, targetId: string): Promise<ContactRecord[]>;
  getRestrictions(targetType: string, targetId: string): Promise<RestrictionRecord[]>;
  getChanges(targetType: string, targetId: string): Promise<ChangeRecord[]>;
}

/** The extra methods needed by tabs that render the contributors section. */
export interface SubmitterAttachmentApi extends AttachmentApi {
  getSubmitters(): Promise<SubmitterRecord[]>;
  getRecordSubmitters(
    targetType: string,
    targetId: string,
  ): Promise<Array<{ id: string; submitterId: string; targetType: string; targetId: string }>>;
}

export interface AttachmentData {
  notes: NoteRecord[];
  allNotes: NoteRecord[];
  citations: CitationRecord[];
  tags: TagRecord[];
  tagLinks: Array<{ tagId: string; link: TagLinkRecord }>;
  identifiers: IdentifierRecord[];
  contacts: ContactRecord[];
  restrictions: RestrictionRecord[];
  changes: ChangeRecord[];
  submitters: SubmitterRecord[];
  contributors: Array<{ id: string; submitterId: string; targetType: string; targetId: string }>;
}

const emptyAttachments = (): AttachmentData => ({
  notes: [],
  allNotes: [],
  citations: [],
  tags: [],
  tagLinks: [],
  identifiers: [],
  contacts: [],
  restrictions: [],
  changes: [],
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
    const [notes, allNotes, citations, tags, tagLinks, identifiers, contacts, restrictions, changes] =
      await Promise.all([
        api.getNotes(targetType, targetId),
        api.getAllNotes(),
        api.getCitations(targetType, targetId),
        api.getTags(),
        api.getTagLinks(targetType, targetId),
        api.getIdentifiers(targetType, targetId),
        api.getContacts(targetType, targetId),
        api.getRestrictions(targetType, targetId),
        api.getChanges(targetType, targetId),
      ]);
    if (!withSubmitters) {
      return {
        ...emptyAttachments(),
        notes,
        allNotes,
        citations,
        tags,
        tagLinks,
        identifiers,
        contacts,
        restrictions,
        changes,
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
      tags,
      tagLinks,
      identifiers,
      contacts,
      restrictions,
      changes,
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

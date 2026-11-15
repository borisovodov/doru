import type {
  AddressRecord,
  AttachmentsSnapshot,
  CitationRecord,
  ContactRecord,
  FactRecord,
  IdentifierRecord,
  MediaLinkRecord,
  MediaRecord,
  NoteLinkRecord,
  NoteRecord,
  RepositoryRecord,
  RestrictionRecord,
  SourceRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
} from '../model/types';
import { emptyAttachments } from '../model/types';
import type { NestedAttachments, Op } from './op';

function op(id: string, kind: string, apply: Op['apply'], inverse: Op['inverse'], change?: Op['change']): Op {
  return { id, kind, timestamp: new Date().toISOString(), ...(change ? { change } : {}), apply, inverse };
}

// --- notes -------------------------------------------------------------------

export function addNoteOp(note: NoteRecord): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'note.write',
      (ctx) => ctx.repo.insertNote(note),
      (ctx) => ctx.repo.deleteNote(note.id),
    ),
    change: { targetType: 'note', targetId: note.id, kind: 'created' },
  };
}

export function updateNoteOp(before: NoteRecord, after: NoteRecord): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'note.update',
      (ctx) => ctx.repo.updateNote(after),
      (ctx) => ctx.repo.updateNote(before),
    ),
    change: { targetType: 'note', targetId: before.id, kind: 'changed' },
  };
}

/**
 * The split-on-edit semantics for shared notes: editing a note from one of
 * its contexts creates a copy for that context instead of rewriting the
 * shared text. `after` is the new note (with the edited text), `link` is the
 * context link moved from `originalId` to it. Undo deletes the copy and
 * returns the link.
 */
export function splitNoteOp(originalId: string, after: NoteRecord, link: NoteLinkRecord): Op {
  return op(
    crypto.randomUUID(),
    'note.splitEdit',
    (ctx) => {
      ctx.repo.removeNoteLink(link.id);
      ctx.repo.insertNote(after);
    },
    (ctx) => {
      ctx.repo.deleteNote(after.id);
      ctx.repo.addNoteLink(originalId, link);
    },
    { targetType: 'note', targetId: after.id, kind: 'created' },
  );
}

export function deleteNoteOp(note: NoteRecord, attachments: AttachmentsSnapshot): Op {
  const owner = note.links?.[0];
  return op(
    crypto.randomUUID(),
    'note.delete',
    (ctx) => ctx.repo.deleteNote(note.id),
    (ctx) => {
      ctx.repo.insertNote(note);
      ctx.repo.restoreAttachments(attachments);
    },
    owner !== undefined
      ? { targetType: owner.targetType, targetId: owner.targetId, kind: 'changed' }
      : { targetType: 'note', targetId: note.id, kind: 'changed' },
  );
}

/** Attaches an existing note to another target (shared-note semantics). */
export function attachNoteOp(noteId: string, link: NoteLinkRecord): Op {
  return op(
    crypto.randomUUID(),
    'note.attach',
    (ctx) => ctx.repo.addNoteLink(noteId, link),
    (ctx) => {
      ctx.repo.removeNoteLink(link.id);
    },
    { targetType: link.targetType, targetId: link.targetId, kind: 'changed' },
  );
}

/**
 * Removes one note link. The last link deletes the note row; the operation
 * keeps the note and its attachments so undo restores both even when the
 * note is shared and the link is not the last one.
 */
export function detachNoteOp(note: NoteRecord, link: NoteLinkRecord, attachments?: AttachmentsSnapshot): Op {
  const last = (note.links?.length ?? 1) <= 1;
  return op(
    crypto.randomUUID(),
    'note.detach',
    (ctx) => {
      ctx.repo.removeNoteLink(link.id);
      if (last) {
        ctx.repo.deleteAttachmentsFor('note', note.id);
      }
    },
    (ctx) => {
      if (ctx.repo.getNote(note.id) === undefined) {
        ctx.repo.insertNote(note);
      } else {
        ctx.repo.addNoteLink(note.id, link);
      }
      if (last && attachments !== undefined) {
        ctx.repo.restoreAttachments(attachments);
      }
    },
    { targetType: link.targetType, targetId: link.targetId, kind: 'changed' },
  );
}

// --- sources -----------------------------------------------------------------

export function addSourceOp(source: SourceRecord, citation?: { targetType: string; targetId: string }): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'source.add',
      (ctx) => {
        ctx.repo.transaction(() => {
          ctx.repo.insertSource(source);
          if (citation) {
            ctx.repo.addSourceCitation(source.id, citation.targetType, citation.targetId);
          }
        });
      },
      (ctx) => ctx.repo.deleteSource(source.id),
    ),
    change: { targetType: 'source', targetId: source.id, kind: 'created' },
  };
}

export function updateSourceOp(before: SourceRecord, after: SourceRecord): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'source.update',
      (ctx) => ctx.repo.updateSource(after),
      (ctx) => ctx.repo.updateSource(before),
    ),
    change: { targetType: 'source', targetId: before.id, kind: 'changed' },
  };
}

export function deleteSourceOp(
  source: SourceRecord,
  attachments: AttachmentsSnapshot,
  citations: CitationRecord[],
  citationAttachments: NestedAttachments[] = [],
): Op {
  return op(
    crypto.randomUUID(),
    'source.delete',
    (ctx) => ctx.repo.deleteSource(source.id),
    (ctx) => {
      ctx.repo.insertSource(source);
      ctx.repo.restoreAttachments(attachments);
      // Citations of the source cascade with the source row (FK) and are
      // not part of the attachment snapshot (that one is keyed by target):
      // re-insert them explicitly so one undo restores everything.
      for (const citation of citations) {
        ctx.repo.insertCitation(citation);
      }
      for (const nested of citationAttachments) {
        ctx.repo.restoreAttachments(nested.attachments);
      }
    },
    { targetType: 'source', targetId: source.id, kind: 'changed' },
  );
}

// --- citations ---------------------------------------------------------------

export function attachCitationOp(citation: CitationRecord): Op {
  return op(
    crypto.randomUUID(),
    'citation.attach',
    (ctx) => ctx.repo.insertCitation(citation),
    (ctx) => ctx.repo.deleteCitation(citation.id),
    { targetType: 'citation', targetId: citation.id, kind: 'created' },
  );
}

export function updateCitationOp(before: CitationRecord, after: CitationRecord): Op {
  return op(
    crypto.randomUUID(),
    'citation.update',
    (ctx) => ctx.repo.updateCitation(after),
    (ctx) => ctx.repo.updateCitation(before),
    { targetType: 'citation', targetId: before.id, kind: 'changed' },
  );
}

export function detachCitationOp(citation: CitationRecord): Op {
  return op(
    crypto.randomUUID(),
    'citation.detach',
    (ctx) => ctx.repo.deleteCitation(citation.id),
    (ctx) => ctx.repo.insertCitation(citation),
    { targetType: citation.targetType, targetId: citation.targetId, kind: 'changed' },
  );
}

// --- media -------------------------------------------------------------------

export function attachMediaOp(
  link: MediaLinkRecord,
  media?: MediaRecord,
  attachments?: AttachmentsSnapshot,
  fileAttachments: NestedAttachments[] = [],
): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'media.attach',
      (ctx) => ctx.repo.addMediaLink(link.mediaId, link),
      (ctx) => {
        ctx.repo.removeMediaLink(link.id);
        if (ctx.repo.getMedia(link.mediaId) === undefined && media !== undefined) {
          ctx.repo.insertMedia(media);
          if (attachments !== undefined) {
            ctx.repo.restoreAttachments(attachments);
          }
          for (const nested of fileAttachments) {
            ctx.repo.restoreAttachments(nested.attachments);
          }
        }
      },
    ),
    change: { targetType: 'media', targetId: link.mediaId, kind: 'changed' },
  };
}

export function updateMediaLinkOp(before: MediaLinkRecord, after: MediaLinkRecord): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'media.linkUpdate',
      (ctx) => ctx.repo.updateMediaLink(after),
      (ctx) => ctx.repo.updateMediaLink(before),
    ),
    change: { targetType: 'media', targetId: before.mediaId, kind: 'changed' },
  };
}

export function detachMediaOp(
  link: MediaLinkRecord,
  media?: MediaRecord,
  attachments?: AttachmentsSnapshot,
  fileAttachments: NestedAttachments[] = [],
): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'media.detach',
      (ctx) => ctx.repo.removeMediaLink(link.id),
      (ctx) => {
        if (ctx.repo.getMedia(link.mediaId) === undefined && media !== undefined) {
          ctx.repo.insertMedia(media);
          if (attachments !== undefined) {
            ctx.repo.restoreAttachments(attachments);
          }
          for (const nested of fileAttachments) {
            ctx.repo.restoreAttachments(nested.attachments);
          }
        } else {
          ctx.repo.addMediaLink(link.mediaId, link);
        }
      },
    ),
    change: { targetType: 'media', targetId: link.mediaId, kind: 'changed' },
  };
}

// --- universal attachments ----------------------------------------------------

export function addIdentifierOp(identifier: IdentifierRecord): Op {
  return op(
    crypto.randomUUID(),
    'identifier.add',
    (ctx) => ctx.repo.insertIdentifier(identifier),
    (ctx) => ctx.repo.deleteIdentifier(identifier.id),
    { targetType: identifier.targetType, targetId: identifier.targetId, kind: 'changed' },
  );
}

export function deleteIdentifierOp(identifier: IdentifierRecord): Op {
  return op(
    crypto.randomUUID(),
    'identifier.delete',
    (ctx) => ctx.repo.deleteIdentifier(identifier.id),
    (ctx) => ctx.repo.insertIdentifier(identifier),
    { targetType: identifier.targetType, targetId: identifier.targetId, kind: 'changed' },
  );
}

/** Changes an identifier's namespace or value. */
export function updateIdentifierOp(before: IdentifierRecord, after: IdentifierRecord): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'identifier.update',
      (ctx) => ctx.repo.updateIdentifier(after),
      (ctx) => ctx.repo.updateIdentifier(before),
    ),
    change: { targetType: after.targetType, targetId: after.targetId, kind: 'changed' },
  };
}

export function addContactOp(contact: ContactRecord): Op {
  return op(
    crypto.randomUUID(),
    'contact.add',
    (ctx) => ctx.repo.insertContact(contact),
    (ctx) => ctx.repo.deleteContact(contact.id),
    { targetType: contact.targetType, targetId: contact.targetId, kind: 'changed' },
  );
}

export function deleteContactOp(contact: ContactRecord): Op {
  return op(
    crypto.randomUUID(),
    'contact.delete',
    (ctx) => ctx.repo.deleteContact(contact.id),
    (ctx) => ctx.repo.insertContact(contact),
    { targetType: contact.targetType, targetId: contact.targetId, kind: 'changed' },
  );
}

/** Changes a contact's kind or value. */
export function updateContactOp(before: ContactRecord, after: ContactRecord): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'contact.update',
      (ctx) => ctx.repo.updateContact(after),
      (ctx) => ctx.repo.updateContact(before),
    ),
    change: { targetType: after.targetType, targetId: after.targetId, kind: 'changed' },
  };
}

export function addRestrictionOp(restriction: RestrictionRecord): Op {
  return op(
    crypto.randomUUID(),
    'restriction.add',
    (ctx) => ctx.repo.insertRestriction(restriction),
    (ctx) => ctx.repo.deleteRestriction(restriction.id),
    { targetType: restriction.targetType, targetId: restriction.targetId, kind: 'changed' },
  );
}

export function deleteRestrictionOp(restriction: RestrictionRecord): Op {
  return op(
    crypto.randomUUID(),
    'restriction.delete',
    (ctx) => ctx.repo.deleteRestriction(restriction.id),
    (ctx) => ctx.repo.insertRestriction(restriction),
    { targetType: restriction.targetType, targetId: restriction.targetId, kind: 'changed' },
  );
}

/** Changes a restriction's level. */
export function updateRestrictionOp(before: RestrictionRecord, after: RestrictionRecord): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'restriction.update',
      (ctx) => ctx.repo.updateRestriction(after),
      (ctx) => ctx.repo.updateRestriction(before),
    ),
    change: { targetType: after.targetType, targetId: after.targetId, kind: 'changed' },
  };
}

export function addTagOp(tag: TagRecord): Op {
  return op(
    crypto.randomUUID(),
    'tag.add',
    (ctx) => ctx.repo.insertTag(tag),
    (ctx) => ctx.repo.deleteTag(tag.id),
    { targetType: 'tag', targetId: tag.id, kind: 'created' },
  );
}

export function updateTagOp(before: TagRecord, after: TagRecord): Op {
  return op(
    crypto.randomUUID(),
    'tag.update',
    (ctx) => ctx.repo.updateTag(after),
    (ctx) => ctx.repo.updateTag(before),
    { targetType: 'tag', targetId: before.id, kind: 'changed' },
  );
}

/**
 * Deletes a tag together with its links (the FK cascade removes the
 * tag_link rows); inverse restores the tag and every link — one undo
 * step, no losses.
 */
export function deleteTagOp(tag: TagRecord, links: TagLinkRecord[]): Op {
  return op(
    crypto.randomUUID(),
    'tag.delete',
    (ctx) => {
      ctx.repo.deleteAttachmentsFor('tag', tag.id);
      ctx.repo.deleteTag(tag.id);
    },
    (ctx) => {
      ctx.repo.insertTag(tag);
      for (const link of links) {
        ctx.repo.insertTagLink(link);
      }
    },
    { targetType: 'tag', targetId: tag.id, kind: 'changed' },
  );
}

export function attachTagOp(link: TagLinkRecord): Op {
  return op(
    crypto.randomUUID(),
    'tag_link.attach',
    (ctx) => ctx.repo.insertTagLink(link),
    (ctx) => ctx.repo.deleteTagLink(link.id),
    { targetType: link.targetType, targetId: link.targetId, kind: 'changed' },
  );
}

export function detachTagOp(link: TagLinkRecord): Op {
  return op(
    crypto.randomUUID(),
    'tag_link.detach',
    (ctx) => ctx.repo.deleteTagLink(link.id),
    (ctx) => ctx.repo.insertTagLink(link),
    { targetType: link.targetType, targetId: link.targetId, kind: 'changed' },
  );
}

/** Changes the attachment date of a tag link. */
export function updateTagLinkOp(before: TagLinkRecord, after: TagLinkRecord): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'tag_link.update',
      (ctx) => ctx.repo.updateTagLink(after),
      (ctx) => ctx.repo.updateTagLink(before),
    ),
    change: { targetType: after.targetType, targetId: after.targetId, kind: 'changed' },
  };
}

// --- registries: repositories, submitters, addresses, fact types, header -------

export function addRepositoryOp(repository: RepositoryRecord): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'repository.add',
      (ctx) => ctx.repo.insertRepository(repository),
      (ctx) => ctx.repo.deleteRepository(repository.id),
    ),
    change: { targetType: 'repository', targetId: repository.id, kind: 'created' },
  };
}

export function updateRepositoryOp(before: RepositoryRecord, after: RepositoryRecord): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'repository.update',
      (ctx) => ctx.repo.updateRepository(after),
      (ctx) => ctx.repo.updateRepository(before),
    ),
    change: { targetType: 'repository', targetId: before.id, kind: 'changed' },
  };
}

/** Source links and call numbers that the repository FK cascade removes. */
export interface RepositoryConsumers {
  sourceRepositories?: Array<{
    id: string;
    sourceId: string;
    repositoryId: string;
    callNumbers?: Array<{ id: string; value: string; medium?: string }>;
  }>;
}

export function deleteRepositoryOp(
  repository: RepositoryRecord,
  attachments: AttachmentsSnapshot,
  consumers: RepositoryConsumers = {},
): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'repository.delete',
      (ctx) => ctx.repo.deleteRepository(repository.id),
      (ctx) => {
        ctx.repo.insertRepository(repository);
        ctx.repo.restoreAttachments(attachments);
        for (const link of consumers.sourceRepositories ?? []) {
          ctx.repo.restoreSourceRepository(link);
        }
      },
    ),
    change: { targetType: 'repository', targetId: repository.id, kind: 'changed' },
  };
}

export function addSubmitterOp(submitter: SubmitterRecord): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'submitter.add',
      (ctx) => ctx.repo.insertSubmitter(submitter),
      (ctx) => ctx.repo.deleteSubmitter(submitter.id),
    ),
    change: { targetType: 'submitter', targetId: submitter.id, kind: 'created' },
  };
}

export function updateSubmitterOp(before: SubmitterRecord, after: SubmitterRecord): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'submitter.update',
      (ctx) => ctx.repo.updateSubmitter(after),
      (ctx) => ctx.repo.updateSubmitter(before),
    ),
    change: { targetType: 'submitter', targetId: before.id, kind: 'changed' },
  };
}

/** Record links that the submitter FK cascade removes. */
export interface SubmitterConsumers {
  recordSubmitters?: Array<{ id: string; submitterId: string; targetType: string; targetId: string }>;
}

export function deleteSubmitterOp(
  submitter: SubmitterRecord,
  attachments: AttachmentsSnapshot,
  consumers: SubmitterConsumers = {},
): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'submitter.delete',
      (ctx) => ctx.repo.deleteSubmitter(submitter.id),
      (ctx) => {
        ctx.repo.insertSubmitter(submitter);
        ctx.repo.restoreAttachments(attachments);
        for (const link of consumers.recordSubmitters ?? []) {
          ctx.repo.insertRecordSubmitter(link.id, link.submitterId, link.targetType, link.targetId);
        }
      },
    ),
    change: { targetType: 'submitter', targetId: submitter.id, kind: 'changed' },
  };
}

/** Links a submitter as the contributor of a record (GEDCOM SUBM on INDI/FAM). */
export function addRecordSubmitterOp(submitterId: string, targetType: string, targetId: string): Op {
  const id = crypto.randomUUID();
  return op(
    id,
    'record_submitter.add',
    (ctx) => ctx.repo.insertRecordSubmitter(id, submitterId, targetType, targetId),
    (ctx) => ctx.repo.deleteRecordSubmitter(id),
    { targetType, targetId, kind: 'changed' },
  );
}

export function deleteRecordSubmitterOp(id: string, submitterId: string, targetType: string, targetId: string): Op {
  return op(
    crypto.randomUUID(),
    'record_submitter.delete',
    (ctx) => ctx.repo.deleteRecordSubmitter(id),
    (ctx) => ctx.repo.insertRecordSubmitter(id, submitterId, targetType, targetId),
    { targetType, targetId, kind: 'changed' },
  );
}

export function addAddressOp(address: AddressRecord): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'address.add',
      (ctx) => ctx.repo.insertAddress(address),
      (ctx) => ctx.repo.deleteAddress(address.id),
    ),
    change: { targetType: 'address', targetId: address.id, kind: 'created' },
  };
}

export function updateAddressOp(before: AddressRecord, after: AddressRecord): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'address.update',
      (ctx) => ctx.repo.updateAddress(after),
      (ctx) => ctx.repo.updateAddress(before),
    ),
    change: { targetType: 'address', targetId: before.id, kind: 'changed' },
  };
}

export function deleteAddressOp(
  address: AddressRecord,
  attachments: AttachmentsSnapshot = emptyAttachments(),
  consumers: { repositories?: RepositoryRecord[]; submitters?: SubmitterRecord[]; facts?: FactRecord[] } = {},
): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'address.delete',
      (ctx) => ctx.repo.deleteAddress(address.id),
      (ctx) => {
        ctx.repo.insertAddress(address);
        ctx.repo.restoreAttachments(attachments);
        for (const repository of consumers.repositories ?? []) {
          ctx.repo.updateRepository({ ...repository, addressId: address.id });
        }
        for (const submitter of consumers.submitters ?? []) {
          ctx.repo.updateSubmitter({ ...submitter, addressId: address.id });
        }
        for (const fact of consumers.facts ?? []) {
          ctx.repo.updateFact({ ...fact, addressId: address.id });
        }
      },
    ),
    change: { targetType: 'address', targetId: address.id, kind: 'changed' },
  };
}

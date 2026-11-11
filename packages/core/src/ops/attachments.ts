import type {
  AddressRecord,
  AttachmentsSnapshot,
  CitationRecord,
  ContactRecord,
  FactTypeRecord,
  IdentifierRecord,
  MediaLinkRecord,
  NoteLinkRecord,
  NoteRecord,
  RepositoryRecord,
  RestrictionRecord,
  SourceRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
} from '../model/types';
import type { Op } from './op';

function op(id: string, kind: string, apply: Op['apply'], inverse: Op['inverse']): Op {
  return { id, kind, timestamp: new Date().toISOString(), apply, inverse };
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
  );
}

export function deleteNoteOp(note: NoteRecord, attachments: AttachmentsSnapshot): Op {
  return op(
    crypto.randomUUID(),
    'note.delete',
    (ctx) => ctx.repo.deleteNote(note.id),
    (ctx) => {
      ctx.repo.insertNote(note);
      ctx.repo.restoreAttachments(attachments);
    },
  );
}

// --- sources -----------------------------------------------------------------

export function addSourceOp(
  source: SourceRecord,
  citation?: { targetType: string; targetId: string },
): Op {
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

export function deleteSourceOp(source: SourceRecord, attachments: AttachmentsSnapshot, citations: CitationRecord[]): Op {
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
    },
  );
}

// --- citations ---------------------------------------------------------------

export function attachCitationOp(citation: CitationRecord): Op {
  return op(
    crypto.randomUUID(),
    'citation.attach',
    (ctx) => ctx.repo.insertCitation(citation),
    (ctx) => ctx.repo.deleteCitation(citation.id),
  );
}

export function updateCitationOp(before: CitationRecord, after: CitationRecord): Op {
  return op(
    crypto.randomUUID(),
    'citation.update',
    (ctx) => ctx.repo.updateCitation(after),
    (ctx) => ctx.repo.updateCitation(before),
  );
}

export function detachCitationOp(citation: CitationRecord): Op {
  return op(
    crypto.randomUUID(),
    'citation.detach',
    (ctx) => ctx.repo.deleteCitation(citation.id),
    (ctx) => ctx.repo.insertCitation(citation),
  );
}

// --- media -------------------------------------------------------------------

export function attachMediaOp(link: MediaLinkRecord): Op {
  return op(
    crypto.randomUUID(),
    'media.attach',
    (ctx) => ctx.repo.addMediaLink(link.mediaId, link),
    (ctx) => ctx.repo.removeMediaLink(link.id),
  );
}

export function detachMediaOp(link: MediaLinkRecord): Op {
  return op(
    crypto.randomUUID(),
    'media.detach',
    (ctx) => ctx.repo.removeMediaLink(link.id),
    (ctx) => ctx.repo.addMediaLink(link.mediaId, link),
  );
}

// --- universal attachments ----------------------------------------------------

export function addIdentifierOp(identifier: IdentifierRecord): Op {
  return op(
    crypto.randomUUID(),
    'identifier.add',
    (ctx) => ctx.repo.insertIdentifier(identifier),
    (ctx) => ctx.repo.deleteIdentifier(identifier.id),
  );
}

export function deleteIdentifierOp(identifier: IdentifierRecord): Op {
  return op(
    crypto.randomUUID(),
    'identifier.delete',
    (ctx) => ctx.repo.deleteIdentifier(identifier.id),
    (ctx) => ctx.repo.insertIdentifier(identifier),
  );
}

export function addContactOp(contact: ContactRecord): Op {
  return op(
    crypto.randomUUID(),
    'contact.add',
    (ctx) => ctx.repo.insertContact(contact),
    (ctx) => ctx.repo.deleteContact(contact.id),
  );
}

export function deleteContactOp(contact: ContactRecord): Op {
  return op(
    crypto.randomUUID(),
    'contact.delete',
    (ctx) => ctx.repo.deleteContact(contact.id),
    (ctx) => ctx.repo.insertContact(contact),
  );
}

export function addRestrictionOp(restriction: RestrictionRecord): Op {
  return op(
    crypto.randomUUID(),
    'restriction.add',
    (ctx) => ctx.repo.insertRestriction(restriction),
    (ctx) => ctx.repo.deleteRestriction(restriction.id),
  );
}

export function deleteRestrictionOp(restriction: RestrictionRecord): Op {
  return op(
    crypto.randomUUID(),
    'restriction.delete',
    (ctx) => ctx.repo.deleteRestriction(restriction.id),
    (ctx) => ctx.repo.insertRestriction(restriction),
  );
}

export function addTagOp(tag: TagRecord): Op {
  return op(
    crypto.randomUUID(),
    'tag.add',
    (ctx) => ctx.repo.insertTag(tag),
    (ctx) => ctx.repo.deleteTag(tag.id),
  );
}

export function deleteTagOp(tag: TagRecord): Op {
  return op(
    crypto.randomUUID(),
    'tag.delete',
    (ctx) => ctx.repo.deleteTag(tag.id),
    (ctx) => ctx.repo.insertTag(tag),
  );
}

export function attachTagOp(link: TagLinkRecord): Op {
  return op(
    crypto.randomUUID(),
    'tag_link.attach',
    (ctx) => ctx.repo.insertTagLink(link),
    (ctx) => ctx.repo.deleteTagLink(link.id),
  );
}

export function detachTagOp(link: TagLinkRecord): Op {
  return op(
    crypto.randomUUID(),
    'tag_link.detach',
    (ctx) => ctx.repo.deleteTagLink(link.id),
    (ctx) => ctx.repo.insertTagLink(link),
  );
}

// --- registries: repositories, submitters, addresses, fact types, header -------

export function addRepositoryOp(repository: RepositoryRecord): Op {
  return op(
    crypto.randomUUID(),
    'repository.add',
    (ctx) => ctx.repo.insertRepository(repository),
    (ctx) => ctx.repo.deleteRepository(repository.id),
  );
}

export function updateRepositoryOp(before: RepositoryRecord, after: RepositoryRecord): Op {
  return op(
    crypto.randomUUID(),
    'repository.update',
    (ctx) => ctx.repo.updateRepository(after),
    (ctx) => ctx.repo.updateRepository(before),
  );
}

export function deleteRepositoryOp(repository: RepositoryRecord, attachments: AttachmentsSnapshot): Op {
  return op(
    crypto.randomUUID(),
    'repository.delete',
    (ctx) => ctx.repo.deleteRepository(repository.id),
    (ctx) => {
      ctx.repo.insertRepository(repository);
      ctx.repo.restoreAttachments(attachments);
    },
  );
}

export function addSubmitterOp(submitter: SubmitterRecord): Op {
  return op(
    crypto.randomUUID(),
    'submitter.add',
    (ctx) => ctx.repo.insertSubmitter(submitter),
    (ctx) => ctx.repo.deleteSubmitter(submitter.id),
  );
}

export function updateSubmitterOp(before: SubmitterRecord, after: SubmitterRecord): Op {
  return op(
    crypto.randomUUID(),
    'submitter.update',
    (ctx) => ctx.repo.updateSubmitter(after),
    (ctx) => ctx.repo.updateSubmitter(before),
  );
}

export function deleteSubmitterOp(submitter: SubmitterRecord, attachments: AttachmentsSnapshot): Op {
  return op(
    crypto.randomUUID(),
    'submitter.delete',
    (ctx) => ctx.repo.deleteSubmitter(submitter.id),
    (ctx) => {
      ctx.repo.insertSubmitter(submitter);
      ctx.repo.restoreAttachments(attachments);
    },
  );
}

export function addAddressOp(address: AddressRecord): Op {
  return op(
    crypto.randomUUID(),
    'address.add',
    (ctx) => ctx.repo.insertAddress(address),
    (ctx) => ctx.repo.deleteAddress(address.id),
  );
}

export function updateAddressOp(before: AddressRecord, after: AddressRecord): Op {
  return op(
    crypto.randomUUID(),
    'address.update',
    (ctx) => ctx.repo.updateAddress(after),
    (ctx) => ctx.repo.updateAddress(before),
  );
}

export function deleteAddressOp(address: AddressRecord): Op {
  return op(
    crypto.randomUUID(),
    'address.delete',
    (ctx) => ctx.repo.deleteAddress(address.id),
    (ctx) => ctx.repo.insertAddress(address),
  );
}

export function addFactTypeOp(type: FactTypeRecord): Op {
  return op(
    crypto.randomUUID(),
    'fact_type.add',
    (ctx) => ctx.repo.insertFactType(type),
    (ctx) => ctx.repo.deleteFactType(type.id),
  );
}

export function updateFactTypeOp(before: FactTypeRecord, after: FactTypeRecord): Op {
  return op(
    crypto.randomUUID(),
    'fact_type.update',
    (ctx) => ctx.repo.updateFactType(after),
    (ctx) => ctx.repo.updateFactType(before),
  );
}

export function deleteFactTypeOp(type: FactTypeRecord): Op {
  return op(
    crypto.randomUUID(),
    'fact_type.delete',
    (ctx) => ctx.repo.deleteFactType(type.id),
    (ctx) => ctx.repo.insertFactType(type),
  );
}

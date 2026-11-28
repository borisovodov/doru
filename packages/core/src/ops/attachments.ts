import type {
  AddressRecord,
  AttachmentsSnapshot,
  CitationRecord,
  ContactRecord,
  MediaLinkRecord,
  NoteRecord,
  RepositoryRecord,
  SubmitterLink,
  SourceRecord,
  SubmitterRecord,
  TitleRecord,
} from '../model/types';
import { emptyAttachments } from '../model/types';
import {
  attachmentTargetExists,
  attachmentsMatch,
  restoreCitation,
  restoreSubmitterLink,
  restoreSource,
  restoreSourceRepository,
  sameRecord,
} from './restore';
import type { MutationContext, NestedAttachments, Op } from './op';

function op(
  id: string,
  kind: string,
  apply: Op['apply'],
  inverse: Op['inverse'],
  change?: Op['change'],
  redoSafe?: NonNullable<Op['redoSafe']>,
): Op {
  return {
    id,
    kind,
    timestamp: new Date().toISOString(),
    ...(change ? { change } : {}),
    ...(redoSafe ? { redoSafe } : {}),
    apply,
    inverse,
  };
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
    change: { targetType: note.targetType, targetId: note.targetId, kind: 'changed' },
  };
}

export function updateNoteOp(before: NoteRecord, after: NoteRecord): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'note.update',
      (ctx) => ctx.repo.updateNote(after),
      (ctx) => ctx.repo.updateNote(before),
      { targetType: before.targetType, targetId: before.targetId, kind: 'changed' },
      (ctx) => {
        const current = ctx.repo.getNote(before.id);
        return current !== undefined && sameRecord(current, before);
      },
    ),
  };
}

export function deleteNoteOp(note: NoteRecord): Op {
  return op(
    crypto.randomUUID(),
    'note.delete',
    (ctx) => ctx.repo.deleteNote(note.id),
    (ctx) => ctx.repo.insertNote(note),
    { targetType: note.targetType, targetId: note.targetId, kind: 'changed' },
    (ctx) => ctx.repo.getNote(note.id) !== undefined && sameRecord(ctx.repo.getNote(note.id), note),
  );
}

// --- sources -----------------------------------------------------------------

export function addSourceOp(source: SourceRecord, citation?: { targetType: string; targetId: string }): Op {
  return addSourceWithCitationsOp(
    source,
    citation === undefined ? [] : [{ id: crypto.randomUUID(), sourceId: source.id, ...citation }],
  );
}

function addSourceWithCitationsOp(source: SourceRecord, citations: CitationRecord[]): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'source.add',
      (ctx) => {
        ctx.repo.transaction(() => {
          ctx.repo.insertSource(source);
          for (const citation of citations) {
            ctx.repo.insertCitation(citation);
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
    redoSafe: (ctx) => {
      const current = ctx.repo.getSource(before.id);
      return current !== undefined && sameRecord(current, before);
    },
  };
}

export function deleteSourceOp(
  source: SourceRecord,
  attachments: AttachmentsSnapshot,
  citations: CitationRecord[],
  citationAttachments: NestedAttachments[] = [],
): Op {
  // The inverse may sanitize a vanished place; redo compares against what
  // was actually persisted, not against the original snapshot.
  let baseline = source;
  let attachmentBaseline = attachments;
  let baselineCitations = citations;
  let baselineCitationAttachments = citationAttachments;
  return op(
    crypto.randomUUID(),
    'source.delete',
    (ctx) => ctx.repo.deleteSource(source.id),
    (ctx) => {
      restoreSource(ctx, source);
      baseline = ctx.repo.getSource(source.id) ?? source;
      ctx.repo.restoreAttachments(attachments);
      // Citations of the source cascade with the source row (FK) and are
      // not part of the attachment snapshot (that one is keyed by target):
      // re-insert them explicitly so one undo restores everything.
      for (const citation of citations) {
        if (ctx.repo.getCitation(citation.id) === undefined) {
          restoreCitation(ctx, citation);
        }
      }
      for (const nested of citationAttachments) {
        if (ctx.repo.getCitation(nested.targetId) !== undefined) {
          ctx.repo.restoreAttachments(nested.attachments);
        }
      }
      attachmentBaseline = ctx.repo.listAttachmentsFor('source', source.id);
      baselineCitations = ctx.repo.listAllCitations().filter((citation) => citation.sourceId === source.id);
      baselineCitationAttachments = baselineCitations.map((citation) => ({
        targetType: 'citation',
        targetId: citation.id,
        attachments: ctx.repo.listAttachmentsFor('citation', citation.id),
      }));
    },
    { targetType: 'source', targetId: source.id, kind: 'changed' },
    (ctx) => {
      if (ctx.repo.getSource(source.id) === undefined || !sameRecord(ctx.repo.getSource(source.id), baseline)) {
        return false;
      }
      if (!attachmentsMatch(ctx, 'source', source.id, attachmentBaseline)) {
        return false;
      }
      const capturedCitations = baselineCitations.map((citation) => JSON.stringify(citation)).sort();
      const liveCitations = ctx.repo
        .listAllCitations()
        .filter((citation) => citation.sourceId === source.id)
        .map((citation) => JSON.stringify(citation))
        .sort();
      if (JSON.stringify(capturedCitations) !== JSON.stringify(liveCitations)) {
        return false;
      }
      return baselineCitationAttachments.every((nested) =>
        attachmentsMatch(ctx, nested.targetType, nested.targetId, nested.attachments),
      );
    },
  );
}

// --- citations ---------------------------------------------------------------

export function attachCitationOp(citation: CitationRecord): Op {
  return attachCitationsOp([citation]);
}

export function attachCitationsOp(citations: CitationRecord[]): Op {
  return op(
    crypto.randomUUID(),
    'citation.attach',
    (ctx) => {
      for (const citation of citations) {
        ctx.repo.insertCitation(citation);
      }
    },
    (ctx) => {
      for (const citation of citations) {
        ctx.repo.deleteCitation(citation.id);
      }
    },
    citations[0] === undefined
      ? undefined
      : { targetType: citations[0].targetType, targetId: citations[0].targetId, kind: 'created' },
  );
}

export function updateCitationOp(before: CitationRecord, after: CitationRecord): Op {
  return op(
    crypto.randomUUID(),
    'citation.update',
    (ctx) => ctx.repo.updateCitation(after),
    (ctx) => ctx.repo.updateCitation(before),
    { targetType: 'citation', targetId: before.id, kind: 'changed' },
    (ctx) => {
      const current = ctx.repo.getCitation(before.id);
      return current !== undefined && sameRecord(current, before);
    },
  );
}

export function detachCitationOp(citation: CitationRecord, attachments: AttachmentsSnapshot = emptyAttachments()): Op {
  return op(
    crypto.randomUUID(),
    'citation.detach',
    (ctx) => ctx.repo.deleteCitation(citation.id),
    (ctx) => {
      if (restoreCitation(ctx, citation)) {
        ctx.repo.restoreAttachments(attachments);
      }
    },
    { targetType: citation.targetType, targetId: citation.targetId, kind: 'changed' },
    (ctx) =>
      ctx.repo.getCitation(citation.id) !== undefined &&
      sameRecord(ctx.repo.getCitation(citation.id), citation) &&
      attachmentsMatch(ctx, 'citation', citation.id, attachments),
  );
}

// --- media -------------------------------------------------------------------

export function attachMediaOp(link: MediaLinkRecord, primaryBefore?: MediaLinkRecord[]): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'media.attach',
      (ctx) => ctx.repo.addMediaLink(link.mediaId, link),
      (ctx) => {
        ctx.repo.removeMediaLink(link.id);
        // Restore only the primary flags this attachment cleared. A concurrent
        // writer may have changed a sibling's crop or target since the capture,
        // so keep those current fields instead of writing the whole row back.
        restorePrimaryFlags(ctx, primaryBefore ?? []);
        const targets = new Map<string, { targetType: string; targetId: string }>();
        for (const before of primaryBefore ?? []) {
          targets.set(`${before.targetType}\u0000${before.targetId}`, {
            targetType: before.targetType,
            targetId: before.targetId,
          });
        }
        for (const target of targets.values()) {
          ctx.repo.normalizePrimaryLink(target.targetType, target.targetId);
        }
      },
    ),
    change: { targetType: 'media', targetId: link.mediaId, kind: 'changed' },
  };
}

type MediaPrimarySnapshot = {
  oldTarget: MediaLinkRecord[];
  newTarget: MediaLinkRecord[];
};

function restorePrimaryFlags(ctx: MutationContext, links: readonly MediaLinkRecord[]): void {
  for (const before of links) {
    const current = ctx.repo.getMedia(before.mediaId)?.links?.find((link) => link.id === before.id);
    if (current === undefined || current.targetType !== before.targetType || current.targetId !== before.targetId) {
      continue;
    }
    ctx.repo.updateMediaLinkRow({ ...current, primary: before.primary });
  }
}

export function updateMediaLinkOp(
  before: MediaLinkRecord,
  after: MediaLinkRecord,
  primaryBefore?: MediaPrimarySnapshot,
): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'media.linkUpdate',
      (ctx) => ctx.repo.updateMediaLink(after),
      (ctx) => {
        ctx.repo.updateMediaLink(before);
        if (primaryBefore === undefined) {
          return;
        }
        restorePrimaryFlags(ctx, primaryBefore.oldTarget);
        restorePrimaryFlags(ctx, primaryBefore.newTarget);
        const targets = new Map<string, { targetType: string; targetId: string }>();
        for (const link of [...primaryBefore.oldTarget, ...primaryBefore.newTarget]) {
          targets.set(`${link.targetType}\u0000${link.targetId}`, {
            targetType: link.targetType,
            targetId: link.targetId,
          });
        }
        for (const target of targets.values()) {
          ctx.repo.normalizePrimaryLink(target.targetType, target.targetId);
        }
      },
    ),
    change: { targetType: 'media', targetId: before.mediaId, kind: 'changed' },
    redoSafe: (ctx) => {
      const current = ctx.repo.getMedia(before.mediaId)?.links?.find((link) => link.id === before.id);
      return current !== undefined && sameRecord(current, before);
    },
  };
}

/** Applies several link-row updates as one undo step and re-checks the primary invariant. */
export function updateMediaLinksOp(pairs: Array<{ before: MediaLinkRecord; after: MediaLinkRecord }>): Op {
  const first = pairs[0];
  const targets = new Map<string, { targetType: string; targetId: string }>();
  for (const pair of pairs) {
    for (const link of [pair.before, pair.after]) {
      targets.set(`${link.targetType}\u0000${link.targetId}`, {
        targetType: link.targetType,
        targetId: link.targetId,
      });
    }
  }
  const normalize = (ctx: MutationContext): void => {
    for (const target of targets.values()) {
      ctx.repo.normalizePrimaryLink(target.targetType, target.targetId);
    }
  };
  return {
    ...op(
      crypto.randomUUID(),
      'media.linkUpdate',
      (ctx) => {
        for (const pair of pairs) {
          ctx.repo.updateMediaLinkRow(pair.after);
        }
        normalize(ctx);
      },
      (ctx) => {
        // Restore only the fields this edit changed. A concurrent writer may
        // have edited another field (for example a sibling's crop) since the
        // capture, and that edit must survive the undo.
        for (const { before, after } of pairs) {
          const current = ctx.repo.getMedia(before.mediaId)?.links?.find((link) => link.id === before.id);
          // A concurrent move owns the row's primary state on its new target.
          if (
            current === undefined ||
            current.targetType !== before.targetType ||
            current.targetId !== before.targetId
          ) {
            continue;
          }
          const restored = { ...current };
          if (JSON.stringify(before.crop) !== JSON.stringify(after.crop)) {
            restored.crop = before.crop;
          }
          if (before.primary !== after.primary) {
            restored.primary = before.primary;
          }
          ctx.repo.updateMediaLinkRow(restored);
        }
        normalize(ctx);
      },
    ),
    ...(first === undefined
      ? {}
      : { change: { targetType: 'media', targetId: first.before.mediaId, kind: 'changed' } }),
    redoSafe: (ctx) =>
      pairs.every((pair) => {
        const current = ctx.repo.getMedia(pair.before.mediaId)?.links?.find((link) => link.id === pair.before.id);
        return current !== undefined && sameRecord(current, pair.before);
      }),
  };
}

export function attachMediaLinksOp(links: MediaLinkRecord[]): Op {
  return op(
    crypto.randomUUID(),
    'media.attach',
    (ctx) => {
      for (const link of links) {
        ctx.repo.addMediaLink(link.mediaId, link);
      }
    },
    (ctx) => {
      for (const link of links) {
        ctx.repo.removeMediaLink(link.id);
      }
    },
    links[0] === undefined ? undefined : { targetType: 'media', targetId: links[0].mediaId, kind: 'changed' },
  );
}

export function detachMediaOp(link: MediaLinkRecord): Op {
  let linkBaseline = link;
  return {
    ...op(
      crypto.randomUUID(),
      'media.detach',
      (ctx) => ctx.repo.removeMediaLink(link.id),
      (ctx) => {
        if (attachmentTargetExists(ctx, link.targetType, link.targetId)) {
          ctx.repo.addMediaLink(link.mediaId, link);
        }
        linkBaseline = ctx.repo.getMedia(link.mediaId)?.links?.find((entry) => entry.id === link.id) ?? link;
      },
    ),
    change: { targetType: 'media', targetId: link.mediaId, kind: 'changed' },
    redoSafe(ctx) {
      const liveLink = ctx.repo.getMedia(link.mediaId)?.links?.find((entry) => entry.id === link.id);
      // The record staying linkless is a valid detached state; if the link
      // is back, redo may only remove the exact row undo restored.
      return liveLink === undefined || sameRecord(liveLink, linkBaseline);
    },
  };
}

// --- universal attachments ----------------------------------------------------

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

/** Source links, call numbers and titles that the repository FK cascade removes. */
export interface RepositoryConsumers {
  sourceRepositories?: Array<{
    id: string;
    sourceId: string;
    repositoryId: string;
    callNumbers?: Array<{ id: string; value: string; medium?: string }>;
  }>;
  titles?: TitleRecord[];
}

export function deleteRepositoryOp(
  repository: RepositoryRecord,
  attachments: AttachmentsSnapshot,
  consumers: RepositoryConsumers = {},
): Op {
  let baselineSources = consumers.sourceRepositories ?? [];
  let baselineTitles = consumers.titles ?? [];
  let baselineAttachments = attachments;
  return {
    ...op(
      crypto.randomUUID(),
      'repository.delete',
      (ctx) => ctx.repo.deleteRepository(repository.id),
      (ctx) => {
        ctx.repo.insertRepository(repository);
        ctx.repo.restoreAttachments(attachments);
        for (const link of consumers.sourceRepositories ?? []) {
          restoreSourceRepository(ctx, link);
        }
        for (const title of consumers.titles ?? []) {
          ctx.repo.setTitleRepositoryId(title.id, repository.id);
        }
        // A concurrent writer may have moved a title to another repository;
        // the inverse leaves that reassignment alone, so the redo comparison
        // must follow what was actually restored.
        baselineSources = ctx.repo.listSourceRepositoriesFor(repository.id);
        baselineTitles = ctx.repo.listTitles().filter((title) => title.repositoryId === repository.id);
        baselineAttachments = ctx.repo.listAttachmentsFor('repository', repository.id);
      },
    ),
    redoSafe(ctx) {
      const current = ctx.repo.getRepository(repository.id);
      if (current === undefined || !sameRecord(current, repository)) {
        return false;
      }
      if (!attachmentsMatch(ctx, 'repository', repository.id, baselineAttachments)) {
        return false;
      }
      const capturedSources = baselineSources.map((link) => JSON.stringify(link)).sort();
      const liveSources = ctx.repo
        .listSourceRepositoriesFor(repository.id)
        .map((link) => JSON.stringify(link))
        .sort();
      if (JSON.stringify(capturedSources) !== JSON.stringify(liveSources)) {
        return false;
      }
      const capturedTitles = baselineTitles.map((title) => title.id).sort();
      const liveTitles = ctx.repo
        .listTitles()
        .filter((title) => title.repositoryId === repository.id)
        .map((title) => title.id)
        .sort();
      return JSON.stringify(capturedTitles) === JSON.stringify(liveTitles);
    },
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
  submitterLinks?: SubmitterLink[];
}

export function deleteSubmitterOp(
  submitter: SubmitterRecord,
  attachments: AttachmentsSnapshot,
  consumers: SubmitterConsumers = {},
): Op {
  let baselineSubmitterLinks = consumers.submitterLinks ?? [];
  let attachmentBaseline = attachments;
  return {
    ...op(
      crypto.randomUUID(),
      'submitter.delete',
      (ctx) => ctx.repo.deleteSubmitter(submitter.id),
      (ctx) => {
        ctx.repo.insertSubmitter(submitter);
        ctx.repo.restoreAttachments(attachments);
        for (const link of consumers.submitterLinks ?? []) {
          // restoreAttachments may already have restored the same link when
          // it belongs to a media link's attachment snapshot.
          if (
            !ctx.repo.listSubmitterLinksFor(link.targetType, link.targetId).some((existing) => existing.id === link.id)
          ) {
            restoreSubmitterLink(ctx, link);
          }
        }
        baselineSubmitterLinks = ctx.repo.listSubmitterLinksForSubmitter(submitter.id);
        attachmentBaseline = ctx.repo.listAttachmentsFor('submitter', submitter.id);
      },
    ),
    change: { targetType: 'submitter', targetId: submitter.id, kind: 'changed' },
    snapshots: [attachments],
    redoSafe(ctx) {
      const current = ctx.repo.getSubmitter(submitter.id);
      if (current === undefined || !sameRecord(current, submitter)) {
        return false;
      }
      if (!attachmentsMatch(ctx, 'submitter', submitter.id, attachmentBaseline)) {
        return false;
      }
      const captured = baselineSubmitterLinks.map((link) => JSON.stringify(link)).sort();
      const live = ctx.repo
        .listSubmitterLinksForSubmitter(submitter.id)
        .map((link) => JSON.stringify(link))
        .sort();
      return JSON.stringify(captured) === JSON.stringify(live);
    },
  };
}

/** Links a submitter as the contributor of a record (GEDCOM SUBM on INDI/FAM). */
export function addSubmitterLinkOp(
  submitterId: string,
  targetType: string,
  targetId: string,
  kind: SubmitterLink['kind'] = 'contributor',
): Op {
  const id = crypto.randomUUID();
  const created = op(
    id,
    'submitter_link.add',
    (ctx) => ctx.repo.insertSubmitterLink(id, submitterId, targetType, targetId, kind),
    (ctx) => ctx.repo.deleteSubmitterLink(id),
    { targetType, targetId, kind: 'changed' },
  );
  return { ...created, dependsOn: [targetId] };
}

export function deleteSubmitterLinkOp(
  id: string,
  submitterId: string,
  targetType: string,
  targetId: string,
  kind: SubmitterLink['kind'] = 'contributor',
): Op {
  return op(
    crypto.randomUUID(),
    'submitter_link.delete',
    (ctx) => ctx.repo.deleteSubmitterLink(id),
    (ctx) => restoreSubmitterLink(ctx, { id, submitterId, targetType, targetId, kind }),
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

export function updateAddressOp(
  before: AddressRecord,
  after: AddressRecord,
  removedAttachments: NestedAttachments[] = [],
): Op {
  return {
    ...op(
      crypto.randomUUID(),
      'address.update',
      (ctx) => ctx.repo.updateAddress(after),
      (ctx) => {
        ctx.repo.updateAddress(before);
        for (const nested of removedAttachments) {
          ctx.repo.restoreAttachments(nested.attachments);
        }
      },
    ),
    change: { targetType: 'address', targetId: before.id, kind: 'changed' },
    redoSafe(ctx) {
      const current = ctx.repo.getAddress(before.id);
      if (current === undefined || !sameRecord(current, before)) {
        return false;
      }
      const lineIds = new Set(current.lines.map((line) => line.id));
      return removedAttachments.every(
        (nested) =>
          !lineIds.has(nested.targetId) ||
          attachmentsMatch(ctx, nested.targetType, nested.targetId, nested.attachments),
      );
    },
  };
}

export function deleteAddressOp(
  address: AddressRecord,
  attachments: AttachmentsSnapshot = emptyAttachments(),
  consumers: {
    repositories?: RepositoryRecord[];
    submitters?: SubmitterRecord[];
    factIds?: string[];
    personIds?: string[];
  } = {},
  nestedAttachments: NestedAttachments[] = [],
): Op {
  let baselineConsumers = {
    repositories: consumers.repositories ?? [],
    submitters: consumers.submitters ?? [],
    factIds: consumers.factIds ?? [],
    personIds: consumers.personIds ?? [],
  };
  let attachmentBaseline = attachments;
  let nestedBaseline = nestedAttachments;
  return {
    ...op(
      crypto.randomUUID(),
      'address.delete',
      (ctx) => ctx.repo.deleteAddress(address.id),
      (ctx) => {
        ctx.repo.insertAddress(address);
        ctx.repo.restoreAttachments(attachments);
        for (const nested of nestedAttachments) {
          ctx.repo.restoreAttachments(nested.attachments);
        }
        for (const repository of consumers.repositories ?? []) {
          ctx.repo.setRepositoryAddressId(repository.id, address.id);
        }
        for (const submitter of consumers.submitters ?? []) {
          ctx.repo.setSubmitterAddressId(submitter.id, address.id);
        }
        for (const factId of consumers.factIds ?? []) {
          ctx.repo.setFactAddressId(factId, address.id);
        }
        for (const personId of consumers.personIds ?? []) {
          ctx.repo.setPersonAddressId(personId, address.id);
        }
        baselineConsumers = {
          repositories: ctx.repo.listRepositories().filter((entry) => entry.addressId === address.id),
          submitters: ctx.repo.listSubmitters().filter((entry) => entry.addressId === address.id),
          factIds: ctx.repo.listFactIdsForAddress(address.id),
          personIds: ctx.repo.listPersonIdsForAddress(address.id),
        };
        attachmentBaseline = ctx.repo.listAttachmentsFor('address', address.id);
        nestedBaseline = nestedAttachments
          .filter((nested) => attachmentTargetExists(ctx, nested.targetType, nested.targetId))
          .map((nested) => ({
            ...nested,
            attachments: ctx.repo.listAttachmentsFor(nested.targetType, nested.targetId),
          }));
      },
    ),
    change: { targetType: 'address', targetId: address.id, kind: 'changed' },
    snapshots: [attachments, ...nestedAttachments.map((nested) => nested.attachments)],
    redoSafe(ctx) {
      const current = ctx.repo.getAddress(address.id);
      if (current === undefined || !sameRecord(current, address)) {
        return false;
      }
      if (!attachmentsMatch(ctx, 'address', address.id, attachmentBaseline)) {
        return false;
      }
      for (const nested of nestedBaseline) {
        const lineExists =
          nested.targetType === 'address_line' && current.lines.some((line) => line.id === nested.targetId);
        if (lineExists && !attachmentsMatch(ctx, nested.targetType, nested.targetId, nested.attachments)) {
          return false;
        }
      }
      const repositories = new Set(baselineConsumers.repositories.map((entry) => entry.id));
      const submitters = new Set(baselineConsumers.submitters.map((entry) => entry.id));
      const facts = new Set(baselineConsumers.factIds);
      const persons = new Set(baselineConsumers.personIds);
      const liveRepositories = ctx.repo
        .listRepositories()
        .filter((entry) => entry.addressId === address.id)
        .map((entry) => entry.id)
        .sort();
      const liveSubmitters = ctx.repo
        .listSubmitters()
        .filter((entry) => entry.addressId === address.id)
        .map((entry) => entry.id)
        .sort();
      return (
        JSON.stringify(liveRepositories) === JSON.stringify([...repositories].sort()) &&
        JSON.stringify(liveSubmitters) === JSON.stringify([...submitters].sort()) &&
        JSON.stringify(ctx.repo.listFactIdsForAddress(address.id).sort()) === JSON.stringify([...facts].sort()) &&
        JSON.stringify(ctx.repo.listPersonIdsForAddress(address.id).sort()) === JSON.stringify([...persons].sort())
      );
    },
  };
}

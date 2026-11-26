import type { AttachmentsSnapshot, MediaRecord } from '../model/types';
import { emptyAttachments } from '../model/types';
import type { NestedAttachments, Op } from './op';
import { attachmentsMatch, restoreMedia, sameRecord } from './restore';

export function addMediaOp(media: MediaRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'media.add',
    timestamp: new Date().toISOString(),
    change: { targetType: 'media', targetId: media.id, kind: 'created' },
    dependsOn:
      media.links?.map((link) => link.targetId) ?? [media.targetId].filter((id): id is string => id !== undefined),
    apply(ctx) {
      ctx.repo.insertMedia(media);
    },
    inverse(ctx) {
      ctx.repo.deleteMedia(media.id);
    },
  };
}

export function updateMediaOp(before: MediaRecord, after: MediaRecord): Op {
  let baseline = before;
  return {
    id: crypto.randomUUID(),
    kind: 'media.update',
    timestamp: new Date().toISOString(),
    change: { targetType: 'media', targetId: before.id, kind: 'changed' },
    apply(ctx) {
      ctx.repo.updateMedia(after);
    },
    inverse(ctx) {
      ctx.repo.updateMedia(before);
      baseline = ctx.repo.getMedia(before.id) ?? before;
    },
    redoSafe(ctx) {
      const current = ctx.repo.getMedia(before.id);
      return current !== undefined && sameRecord(current, baseline);
    },
  };
}

export function deleteMediaOp(
  media: MediaRecord,
  attachments: AttachmentsSnapshot = emptyAttachments(),
  linkAttachments: NestedAttachments[] = [],
): Op {
  let baseline = media;
  let attachmentBaseline = attachments;
  let linkBaseline = linkAttachments;
  return {
    id: crypto.randomUUID(),
    kind: 'media.delete',
    timestamp: new Date().toISOString(),
    change: { targetType: 'media', targetId: media.id, kind: 'changed' },
    snapshots: [attachments, ...linkAttachments.map((nested) => nested.attachments)],
    apply(ctx) {
      ctx.repo.deleteMedia(media.id);
    },
    redoSafe(ctx) {
      const current = ctx.repo.getMedia(media.id);
      if (current === undefined || !sameRecord(current, baseline)) {
        return false;
      }
      const linkIds = new Set((baseline.links ?? []).map((link) => link.id));
      for (const link of current.links ?? []) {
        if (!linkIds.has(link.id)) {
          return false;
        }
      }
      if (!attachmentsMatch(ctx, 'media', media.id, attachmentBaseline)) {
        return false;
      }
      for (const nested of linkBaseline) {
        if (!attachmentsMatch(ctx, nested.targetType, nested.targetId, nested.attachments)) {
          return false;
        }
      }
      return true;
    },
    inverse(ctx) {
      const restoredLinks = restoreMedia(ctx, media);
      ctx.repo.restoreAttachments(attachments);
      for (const nested of linkAttachments) {
        if (restoredLinks.has(nested.targetId)) {
          ctx.repo.restoreAttachments(nested.attachments);
        }
      }
      const current = ctx.repo.getMedia(media.id) ?? media;
      baseline = current;
      attachmentBaseline = ctx.repo.listAttachmentsFor('media', media.id);
      const linkSnapshotById = new Map(linkAttachments.map((nested) => [nested.targetId, nested]));
      linkBaseline = (baseline.links ?? []).flatMap((link) => {
        const nested = linkSnapshotById.get(link.id);
        return nested === undefined
          ? []
          : [
              {
                ...nested,
                attachments: ctx.repo.listAttachmentsFor(nested.targetType, nested.targetId),
              },
            ];
      });
    },
  };
}

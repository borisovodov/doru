import type { AttachmentsSnapshot, MediaRecord } from '../model/types';
import { emptyAttachments } from '../model/types';
import type { Op } from './op';
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

export function deleteMediaOp(media: MediaRecord, attachments: AttachmentsSnapshot = emptyAttachments()): Op {
  let baseline = media;
  let attachmentBaseline = attachments;
  return {
    id: crypto.randomUUID(),
    kind: 'media.delete',
    timestamp: new Date().toISOString(),
    change: { targetType: 'media', targetId: media.id, kind: 'changed' },
    snapshots: [attachments],
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
      return attachmentsMatch(ctx, 'media', media.id, attachmentBaseline);
    },
    inverse(ctx) {
      restoreMedia(ctx, media);
      ctx.repo.restoreAttachments(attachments);
      const current = ctx.repo.getMedia(media.id) ?? media;
      baseline = current;
      attachmentBaseline = ctx.repo.listAttachmentsFor('media', media.id);
    },
  };
}

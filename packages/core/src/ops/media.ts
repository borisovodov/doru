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
    apply(ctx) {
      ctx.repo.insertMedia(media);
    },
    inverse(ctx) {
      ctx.repo.deleteMedia(media.id);
    },
  };
}

export function updateMediaOp(before: MediaRecord, after: MediaRecord, fileAttachments: NestedAttachments[] = []): Op {
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
      for (const nested of fileAttachments) {
        ctx.repo.restoreAttachments(nested.attachments);
      }
    },
  };
}

export function deleteMediaOp(
  media: MediaRecord,
  attachments: AttachmentsSnapshot = emptyAttachments(),
  fileAttachments: NestedAttachments[] = [],
  linkAttachments: NestedAttachments[] = [],
): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'media.delete',
    timestamp: new Date().toISOString(),
    change: { targetType: 'media', targetId: media.id, kind: 'changed' },
    apply(ctx) {
      ctx.repo.deleteMedia(media.id);
    },
    redoSafe(ctx) {
      const current = ctx.repo.getMedia(media.id);
      if (current === undefined || !sameRecord(current, media)) {
        return false;
      }
      const fileIds = new Set((media.files ?? []).map((file) => file.id));
      for (const file of current.files ?? []) {
        if (!fileIds.has(file.id)) {
          return false;
        }
      }
      const linkIds = new Set((media.links ?? []).map((link) => link.id));
      for (const link of current.links ?? []) {
        if (!linkIds.has(link.id)) {
          return false;
        }
      }
      if (!attachmentsMatch(ctx, 'media', media.id, attachments)) {
        return false;
      }
      for (const nested of fileAttachments) {
        if (!attachmentsMatch(ctx, nested.targetType, nested.targetId, nested.attachments)) {
          return false;
        }
      }
      for (const nested of linkAttachments) {
        if (!attachmentsMatch(ctx, nested.targetType, nested.targetId, nested.attachments)) {
          return false;
        }
      }
      return true;
    },
    inverse(ctx) {
      restoreMedia(ctx, media);
      ctx.repo.restoreAttachments(attachments);
      for (const nested of fileAttachments) {
        ctx.repo.restoreAttachments(nested.attachments);
      }
      for (const nested of linkAttachments) {
        ctx.repo.restoreAttachments(nested.attachments);
      }
    },
  };
}

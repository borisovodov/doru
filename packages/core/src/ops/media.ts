import type { AttachmentsSnapshot, MediaRecord } from '../model/types';
import { emptyAttachments } from '../model/types';
import type { NestedAttachments, Op } from './op';

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
): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'media.delete',
    timestamp: new Date().toISOString(),
    change: { targetType: 'media', targetId: media.id, kind: 'changed' },
    apply(ctx) {
      ctx.repo.deleteMedia(media.id);
    },
    inverse(ctx) {
      ctx.repo.insertMedia(media);
      ctx.repo.restoreAttachments(attachments);
      for (const nested of fileAttachments) {
        ctx.repo.restoreAttachments(nested.attachments);
      }
    },
  };
}

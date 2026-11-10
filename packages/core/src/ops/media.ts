import type { AttachmentsSnapshot, MediaRecord } from '../model/types';
import { emptyAttachments } from '../model/types';
import type { Op } from './op';

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

export function deleteMediaOp(media: MediaRecord, attachments: AttachmentsSnapshot = emptyAttachments()): Op {
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
    },
  };
}

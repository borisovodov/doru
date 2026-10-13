import type { EventRecord, MediaRecord } from '../model/types';
import type { Op } from './op';

export function addEventOp(event: EventRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'event.add',
    timestamp: new Date().toISOString(),
    apply(ctx) {
      ctx.repo.insertEvent(event);
    },
    inverse(ctx) {
      ctx.repo.deleteEvent(event.id);
    },
  };
}

export function deleteEventOp(event: EventRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'event.delete',
    timestamp: new Date().toISOString(),
    apply(ctx) {
      ctx.repo.deleteEvent(event.id);
    },
    inverse(ctx) {
      ctx.repo.insertEvent(event);
    },
  };
}

export function addMediaOp(media: MediaRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'media.add',
    timestamp: new Date().toISOString(),
    apply(ctx) {
      ctx.repo.insertMedia(media);
    },
    inverse(ctx) {
      ctx.repo.deleteMedia(media.id);
    },
  };
}

export function deleteMediaOp(media: MediaRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'media.delete',
    timestamp: new Date().toISOString(),
    apply(ctx) {
      ctx.repo.deleteMedia(media.id);
    },
    inverse(ctx) {
      ctx.repo.insertMedia(media);
    },
  };
}

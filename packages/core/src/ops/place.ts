import type { AttachmentsSnapshot, FactRecord, PlaceRecord } from '../model/types';
import { emptyAttachments } from '../model/types';
import type { Op } from './op';

export function addPlaceOp(place: PlaceRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'place.add',
    timestamp: new Date().toISOString(),
    change: { targetType: 'place', targetId: place.id, kind: 'created' },
    apply(ctx) {
      ctx.repo.insertPlace(place);
    },
    inverse(ctx) {
      ctx.repo.deletePlace(place.id);
    },
  };
}

export function updatePlaceOp(before: PlaceRecord, after: PlaceRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'place.update',
    timestamp: new Date().toISOString(),
    change: { targetType: 'place', targetId: before.id, kind: 'changed' },
    apply(ctx) {
      ctx.repo.updatePlace(after);
    },
    inverse(ctx) {
      ctx.repo.updatePlace(before);
    },
  };
}

/**
 * Deletes a place together with the facts that referenced it (their raw
 * place string survives in `place_text`) and the place's attachments;
 * inverse restores everything — one undo step, no losses.
 */
export function deletePlaceOp(
  place: PlaceRecord,
  facts: Array<{ before: FactRecord; after: FactRecord }>,
  attachments: AttachmentsSnapshot = emptyAttachments(),
): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'place.delete',
    timestamp: new Date().toISOString(),
    change: { targetType: 'place', targetId: place.id, kind: 'changed' },
    apply(ctx) {
      for (const link of facts) {
        ctx.repo.updateFact(link.after);
      }
      ctx.repo.deletePlace(place.id);
    },
    inverse(ctx) {
      ctx.repo.insertPlace(place);
      for (const link of [...facts].reverse()) {
        ctx.repo.updateFact(link.before);
      }
      ctx.repo.restoreAttachments(attachments);
    },
  };
}

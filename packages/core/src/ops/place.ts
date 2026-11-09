import type { FactRecord, PlaceRecord } from '../model/types';
import type { Op } from './op';

export function addPlaceOp(place: PlaceRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'place.add',
    timestamp: new Date().toISOString(),
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
 * place string survives in `place_text`); inverse restores both — one undo
 * step, no orphaned links.
 */
export function deletePlaceOp(
  place: PlaceRecord,
  facts: Array<{ before: FactRecord; after: FactRecord }>,
): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'place.delete',
    timestamp: new Date().toISOString(),
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
    },
  };
}

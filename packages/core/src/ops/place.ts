import type { AttachmentsSnapshot, FactRecord, FamilyRecord, PlaceRecord, SourceRecord } from '../model/types';
import { emptyAttachments } from '../model/types';
import type { NestedAttachments, Op } from './op';

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

export function updatePlaceOp(
  before: PlaceRecord,
  after: PlaceRecord,
  removedAttachments: NestedAttachments[] = [],
): Op {
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
      for (const nested of removedAttachments) {
        ctx.repo.restoreAttachments(nested.attachments);
      }
    },
  };
}

/**
 * Deletes a place together with the facts that referenced it (their raw
 * place string survives in `place_text`) and the place's attachments;
 * inverse restores everything — one undo step, no losses.
 */
export interface PlaceConsumers {
  /** Families whose marriage-status row points at the place (FK SET NULL). */
  families?: FamilyRecord[];
  /** Sources whose data-event row points at the place (FK SET NULL). */
  sources?: SourceRecord[];
  /** Places whose hierarchy row has the deleted place as its parent (FK CASCADE). */
  childPlaces?: PlaceRecord[];
}

export function deletePlaceOp(
  place: PlaceRecord,
  facts: Array<{ before: FactRecord; after: FactRecord }>,
  attachments: AttachmentsSnapshot = emptyAttachments(),
  consumers: PlaceConsumers = {},
  nestedAttachments: NestedAttachments[] = [],
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
      for (const child of consumers.childPlaces ?? []) {
        ctx.repo.updatePlace(child);
      }
      for (const family of consumers.families ?? []) {
        ctx.repo.updateFamily(family);
      }
      for (const source of consumers.sources ?? []) {
        ctx.repo.updateSource(source);
      }
      for (const link of [...facts].reverse()) {
        ctx.repo.updateFact(link.before);
      }
      ctx.repo.restoreAttachments(attachments);
      for (const nested of nestedAttachments) {
        ctx.repo.restoreAttachments(nested.attachments);
      }
    },
  };
}

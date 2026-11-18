import type {
  AttachmentsSnapshot,
  FactRecord,
  FamilyRecord,
  MediaRecord,
  PlaceRecord,
  SourceRecord,
} from '../model/types';
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
  /** Media records whose historical place points at the deleted place (FK SET NULL). */
  media?: MediaRecord[];
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
      // Only the hierarchy row whose parent was deleted cascades; restore it
      // by id and leave any later edits to the child place intact.
      for (const child of consumers.childPlaces ?? []) {
        for (const link of child.hierarchy ?? []) {
          if (link.parentId === place.id) {
            ctx.repo.insertPlaceHierarchy(child.id, link);
          }
        }
      }
      for (const family of consumers.families ?? []) {
        for (const status of family.marriageStatuses ?? []) {
          if (status.placeId === place.id) {
            ctx.repo.setFamilyMarriageStatusPlaceId(status.id, place.id);
          }
        }
      }
      for (const source of consumers.sources ?? []) {
        for (const event of source.dataEvents ?? []) {
          if (event.placeId === place.id) {
            ctx.repo.setSourceDataEventPlaceId(event.id, place.id);
          }
        }
      }
      for (const link of [...facts].reverse()) {
        // Surviving facts may have been edited; restore only the place
        // references the delete removed, and only when still unset.
        const current = ctx.repo.getFact(link.before.id);
        if (current === undefined) {
          continue;
        }
        if (link.before.placeId !== undefined && current.placeId === undefined) {
          ctx.repo.setFactPlaceId(link.before.id, link.before.placeId);
        }
        for (const [position, placeId] of (link.before.additionalPlaceIds ?? []).entries()) {
          if (!(current.additionalPlaceIds ?? []).includes(placeId)) {
            ctx.repo.insertFactPlace(link.before.id, placeId, position);
          }
        }
      }
      ctx.repo.restoreAttachments(attachments);
      for (const nested of nestedAttachments) {
        ctx.repo.restoreAttachments(nested.attachments);
      }
      for (const media of consumers.media ?? []) {
        ctx.repo.setMediaPlaceId(media.id, place.id);
      }
    },
  };
}

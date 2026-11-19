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
import { sameRecord } from './restore';

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
  facts: Array<{ before: FactRecord; after: FactRecord; position?: number }>,
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
        ctx.repo.detachFactPlace(link.before.id, place.id);
      }
      ctx.repo.deletePlace(place.id);
    },
    redoSafe(ctx) {
      const current = ctx.repo.getPlace(place.id);
      if (current === undefined || !sameRecord(current, place)) {
        return false;
      }
      // Consumers added since the undo would be cleared by the redo and are
      // absent from the captured snapshots, so they could never come back.
      const factIds = new Set(facts.map((link) => link.before.id));
      for (const fact of [
        ...ctx.repo.listFactsForPlace(place.id),
        ...ctx.repo.listFactsWithAdditionalPlace(place.id),
      ]) {
        if (!factIds.has(fact.id)) {
          return false;
        }
      }
      const familyIds = new Set((consumers.families ?? []).map((family) => family.id));
      for (const family of ctx.repo.listFamilies()) {
        if (
          (family.marriageStatuses ?? []).some((status) => status.placeId === place.id) &&
          !familyIds.has(family.id)
        ) {
          return false;
        }
      }
      const sourceIds = new Set((consumers.sources ?? []).map((source) => source.id));
      for (const source of ctx.repo.listSources()) {
        if ((source.dataEvents ?? []).some((event) => event.placeId === place.id) && !sourceIds.has(source.id)) {
          return false;
        }
      }
      const mediaIds = new Set((consumers.media ?? []).map((media) => media.id));
      for (const media of ctx.repo.listAllMedia()) {
        if (media.placeId === place.id && !mediaIds.has(media.id)) {
          return false;
        }
      }
      const childIds = new Set((consumers.childPlaces ?? []).map((child) => child.id));
      for (const child of ctx.repo.listPlaces()) {
        if ((child.hierarchy ?? []).some((link) => link.parentId === place.id) && !childIds.has(child.id)) {
          return false;
        }
      }
      return true;
    },
    inverse(ctx) {
      ctx.repo.insertPlace(place);
      // Only the hierarchy row whose parent was deleted cascades; restore it
      // by id and leave any later edits to the child place intact. A child
      // deleted by another writer cannot take the row (or its attachments).
      const skippedHierarchy = new Set<string>();
      for (const child of consumers.childPlaces ?? []) {
        if (ctx.repo.getPlace(child.id) === undefined) {
          for (const link of child.hierarchy ?? []) {
            if (link.parentId === place.id) {
              skippedHierarchy.add(link.id);
            }
          }
          continue;
        }
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
        if (link.before.placeId === place.id && current.placeId === undefined) {
          ctx.repo.setFactPlaceId(link.before.id, place.id);
        }
        for (const [index, placeId] of (link.before.additionalPlaceIds ?? []).entries()) {
          if (placeId === place.id && !(current.additionalPlaceIds ?? []).includes(placeId)) {
            // Restore at the row's stored position so later deletions that
            // left gaps do not reshuffle the surviving additional places.
            ctx.repo.insertFactPlace(link.before.id, placeId, link.position ?? index);
          }
        }
      }
      ctx.repo.restoreAttachments(attachments);
      for (const nested of nestedAttachments) {
        if (nested.targetType === 'place_hierarchy' && skippedHierarchy.has(nested.targetId)) {
          continue;
        }
        ctx.repo.restoreAttachments(nested.attachments);
      }
      for (const media of consumers.media ?? []) {
        ctx.repo.setMediaPlaceId(media.id, place.id);
      }
    },
  };
}

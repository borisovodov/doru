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
import { attachmentsMatch, restorePlace, sameRecord } from './restore';

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
    redoSafe(ctx) {
      const current = ctx.repo.getPlace(before.id);
      if (current === undefined || !sameRecord(current, before)) {
        return false;
      }
      const nameIds = new Set(current.names.map((name) => name.id));
      const hierarchyIds = new Set((current.hierarchy ?? []).map((link) => link.id));
      return removedAttachments.every((nested) => {
        const exists =
          nested.targetType === 'place_name'
            ? nameIds.has(nested.targetId)
            : nested.targetType === 'place_hierarchy'
              ? hierarchyIds.has(nested.targetId)
              : true;
        return !exists || attachmentsMatch(ctx, nested.targetType, nested.targetId, nested.attachments);
      });
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
  facts: Array<{ before: FactRecord; after: FactRecord; positions?: number[] }>,
  attachments: AttachmentsSnapshot = emptyAttachments(),
  consumers: PlaceConsumers = {},
  nestedAttachments: NestedAttachments[] = [],
): Op {
  let baselinePlace = place;
  let baselineHierarchyLinks = [
    ...(place.hierarchy ?? []),
    ...(consumers.childPlaces ?? []).flatMap((child) =>
      (child.hierarchy ?? []).filter((link) => link.parentId === place.id),
    ),
  ];
  return {
    id: crypto.randomUUID(),
    kind: 'place.delete',
    timestamp: new Date().toISOString(),
    change: { targetType: 'place', targetId: place.id, kind: 'changed' },
    snapshots: [attachments, ...nestedAttachments.map((nested) => nested.attachments)],
    apply(ctx) {
      for (const link of facts) {
        ctx.repo.detachFactPlace(link.before.id, place.id);
      }
      ctx.repo.deletePlace(place.id);
    },
    redoSafe(ctx) {
      const current = ctx.repo.getPlace(place.id);
      if (current === undefined || !sameRecord(current, baselinePlace)) {
        return false;
      }
      if (!attachmentsMatch(ctx, 'place', place.id, attachments)) {
        return false;
      }
      const places = ctx.repo.listPlaces();
      const liveHierarchyLinks = [
        ...(current.hierarchy ?? []),
        ...places.flatMap((entry) => (entry.hierarchy ?? []).filter((link) => link.parentId === place.id)),
      ];
      const liveHierarchy = new Set(liveHierarchyLinks.map((link) => link.id));
      const liveNames = new Set(current.names.map((name) => name.id));
      for (const nested of nestedAttachments) {
        if (nested.targetType === 'place_name' && liveNames.has(nested.targetId)) {
          if (!attachmentsMatch(ctx, 'place_name', nested.targetId, nested.attachments)) {
            return false;
          }
        }
        if (nested.targetType === 'place_hierarchy' && liveHierarchy.has(nested.targetId)) {
          if (!attachmentsMatch(ctx, 'place_hierarchy', nested.targetId, nested.attachments)) {
            return false;
          }
        }
      }
      // Consumers added since the undo would be cleared by the redo and are
      // absent from the captured snapshots, so they could never come back.
      const capturedFacts = new Map(facts.map((link) => [link.before.id, link.before]));
      for (const fact of [
        ...ctx.repo.listFactsForPlace(place.id),
        ...ctx.repo.listFactsWithAdditionalPlace(place.id),
      ]) {
        if (!capturedFacts.has(fact.id)) {
          return false;
        }
      }
      const livePositions = new Map<string, number[]>();
      for (const row of ctx.repo.listFactPlaceRows(place.id)) {
        const positions = livePositions.get(row.factId) ?? [];
        positions.push(row.position);
        livePositions.set(row.factId, positions);
      }
      for (const [factId, captured] of capturedFacts) {
        const fact = ctx.repo.getFact(factId);
        if (fact === undefined) {
          continue;
        }
        if ((fact.placeId === place.id) !== (captured.placeId === place.id)) {
          return false;
        }
        const capturedPositions = facts.find((entry) => entry.before.id === factId)?.positions ?? [];
        const currentPositions = livePositions.get(factId) ?? [];
        if (
          capturedPositions.length !== currentPositions.length ||
          capturedPositions.some((position, index) => position !== currentPositions[index])
        ) {
          return false;
        }
      }
      const capturedStatuses = new Set(
        (consumers.families ?? []).flatMap((family) =>
          (family.marriageStatuses ?? []).filter((status) => status.placeId === place.id).map((status) => status.id),
        ),
      );
      const currentStatuses = new Set(
        ctx.repo
          .listFamilies()
          .flatMap((family) =>
            (family.marriageStatuses ?? []).filter((status) => status.placeId === place.id).map((status) => status.id),
          ),
      );
      if (
        capturedStatuses.size !== currentStatuses.size ||
        [...capturedStatuses].some((id) => !currentStatuses.has(id))
      ) {
        return false;
      }
      const capturedEvents = new Set(
        (consumers.sources ?? []).flatMap((source) =>
          (source.dataEvents ?? []).filter((event) => event.placeId === place.id).map((event) => event.id),
        ),
      );
      const currentEvents = new Set(
        ctx.repo
          .listSources()
          .flatMap((source) =>
            (source.dataEvents ?? []).filter((event) => event.placeId === place.id).map((event) => event.id),
          ),
      );
      if (capturedEvents.size !== currentEvents.size || [...capturedEvents].some((id) => !currentEvents.has(id))) {
        return false;
      }
      if (
        JSON.stringify(baselineHierarchyLinks.map((link) => JSON.stringify(link)).sort()) !==
        JSON.stringify(liveHierarchyLinks.map((link) => JSON.stringify(link)).sort())
      ) {
        return false;
      }
      const capturedMedia = new Set(
        (consumers.media ?? []).filter((entry) => entry.placeId === place.id).map((entry) => entry.id),
      );
      const currentMedia = new Set(
        ctx.repo
          .listAllMedia()
          .filter((entry) => entry.placeId === place.id)
          .map((entry) => entry.id),
      );
      return capturedMedia.size === currentMedia.size && [...capturedMedia].every((id) => currentMedia.has(id));
    },
    inverse(ctx) {
      restorePlace(ctx, place);
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
        let occurrence = 0;
        for (const [index, placeId] of (link.before.additionalPlaceIds ?? []).entries()) {
          if (placeId === place.id && !(current.additionalPlaceIds ?? []).includes(placeId)) {
            const position = link.positions?.[occurrence] ?? index;
            occurrence += 1;
            ctx.repo.insertFactPlace(link.before.id, placeId, position);
          }
        }
      }
      ctx.repo.restoreAttachments(attachments);
      const restoredNames = new Set(ctx.repo.getPlace(place.id)?.names.map((name) => name.id) ?? []);
      const restoredHierarchy = new Set([
        ...(ctx.repo.getPlace(place.id)?.hierarchy ?? []).map((link) => link.id),
        ...ctx.repo
          .listPlaces()
          .flatMap((entry) =>
            (entry.hierarchy ?? []).filter((link) => link.parentId === place.id).map((link) => link.id),
          ),
      ]);
      for (const nested of nestedAttachments) {
        if (nested.targetType === 'place_hierarchy') {
          if (skippedHierarchy.has(nested.targetId) || !restoredHierarchy.has(nested.targetId)) {
            continue;
          }
        }
        if (nested.targetType === 'place_name' && !restoredNames.has(nested.targetId)) {
          continue;
        }
        ctx.repo.restoreAttachments(nested.attachments);
      }
      for (const media of consumers.media ?? []) {
        ctx.repo.setMediaPlaceId(media.id, place.id);
      }
      baselinePlace = ctx.repo.getPlace(place.id) ?? place;
      baselineHierarchyLinks = [
        ...(baselinePlace.hierarchy ?? []),
        ...ctx.repo
          .listPlaces()
          .flatMap((entry) => (entry.hierarchy ?? []).filter((link) => link.parentId === place.id)),
      ];
    },
  };
}

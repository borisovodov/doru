/**
 * Model-graph walks over the place structures.
 *
 * The GEDCOM model is a plain object graph — the specifications' tree
 * in TypeScript notation — so the cross-cutting traversals are
 * structural. Both layers share this walker: the parser resolves the
 * name-based `_LOC` links with it (parsing/places.ts) and the
 * serializers' projections collect the referencing places with it
 * (serialize/prepare.ts).
 */

import type { PlaceStructure } from './structures';

/**
 * Collects every PlaceStructure reachable from the given root (the
 * model is a plain object graph, so the walk is structural).
 */
export function collectPlaces(root: unknown): PlaceStructure[] {
  const out: PlaceStructure[] = [];
  // An iterative structural walk: the model is a plain object graph,
  // and a hand-made file can nest thousands of extension levels (the
  // same reason parseExtension, emitExtension and the serialize-side
  // walks iterate).
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const value = stack.pop();
    if (Array.isArray(value)) {
      for (const item of value) {
        stack.push(item);
      }
      continue;
    }
    if (value === null || typeof value !== 'object') {
      continue;
    }
    const obj = value as Record<string, unknown>;
    if (obj['tag'] === 'PLAC' && Array.isArray(obj['payload'])) {
      out.push(value as PlaceStructure);
    }
    for (const key of Object.keys(obj)) {
      stack.push(obj[key]);
    }
  }
  return out;
}

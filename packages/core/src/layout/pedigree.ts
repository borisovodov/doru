import type { FamilyRecord, PersonRecord } from '../model/types';
import { boundsOf } from './geometry';
import {
  DEFAULT_OPTIONS,
  type LaidOutCard,
  type PedigreeEdge,
  type PedigreeLayout,
  type PedigreeLayoutOptions,
} from './types';
import { layoutDirectional } from './directional';
import { layoutFamilyView } from './family';
import type { SeeAlso } from './graph';

/**
 * Pedigree layout: pure functions that turn the domain model
 * (persons + families) into canvas coordinates. No DOM, no React — this is
 * the domain core of the tree editor and stays testable in isolation.
 *
 * Genealogy is a DAG (second marriages, pedigree collapse), so the graph is
 * turned into a tree by duplicating a person per family role. Cards carry
 * role-based keys that stay stable across refocuses:
 * - `person:<id>@focus` — the focus person;
 * - `person:<id>@spouse:<familyId>` — a person as a member of a couple;
 * - `person:<id>@child:<familyId>` — a person as a child of a family.
 *
 * Four chart kinds share the same building blocks:
 * - ancestors / descendants: alternating person/couple tidy trees around the
 *   focus, one direction each (directional.ts);
 * - hourglass: ancestors and descendants merged at the focus;
 * - family: the focus couple with children below and both sides' parents
 *   above, laid out directly (family.ts).
 */

/**
 * Picks a sensible default focus person: prefer a "leaf" of the descendant
 * direction — someone who is a child in some family but has no children of
 * their own (typically the youngest generation). Falls back to any child,
 * then to the first person in list order.
 */
export function suggestFocusPerson(
  persons: PersonRecord[],
  families: FamilyRecord[],
): string | undefined {
  if (persons.length === 0) {
    return undefined;
  }
  const children = new Set<string>();
  const parents = new Set<string>();
  for (const family of families) {
    for (const id of family.children) {
      children.add(id);
    }
    for (const id of family.parents) {
      parents.add(id);
    }
  }
  for (const person of persons) {
    if (children.has(person.id) && !parents.has(person.id)) {
      return person.id;
    }
  }
  for (const person of persons) {
    if (children.has(person.id)) {
      return person.id;
    }
  }
  return persons[0]?.id;
}

/**
 * Whether `ancestorId` sits on the ancestry chain above `personId` (i.e.
 * `personId` descends from `ancestorId`). Used to reject reparenting that
 * would create an ancestry cycle.
 */
export function isDescendantOf(
  families: FamilyRecord[],
  ancestorId: string,
  personId: string,
): boolean {
  if (ancestorId === personId) {
    return true;
  }
  const parentsByChild = new Map<string, string[]>();
  for (const family of families) {
    for (const childId of family.children) {
      const list = parentsByChild.get(childId) ?? [];
      list.push(...family.parents);
      parentsByChild.set(childId, list);
    }
  }
  const queue = [personId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || visited.has(current)) {
      continue;
    }
    visited.add(current);
    for (const parentId of parentsByChild.get(current) ?? []) {
      if (parentId === ancestorId) {
        return true;
      }
      queue.push(parentId);
    }
  }
  return false;
}

interface EdgeHost {
  cards: LaidOutCard[];
  edges: PedigreeEdge[];
}

/** Adds dashed "see also" links for persons skipped because of ancestry cycles. */
function addSeeAlsoEdges(layout: EdgeHost, seeAlso: SeeAlso[]): void {
  const cardByKey = new Map(layout.cards.map((card) => [card.key, card]));
  for (const link of seeAlso) {
    const owner = cardByKey.get(link.ownerKey);
    const target = layout.cards
      .filter((card) => card.personId === link.personId)
      .sort(
        (a, b) =>
          Math.abs(a.generation - (owner?.generation ?? 0)) -
          Math.abs(b.generation - (owner?.generation ?? 0)),
      )[0];
    if (!owner || !target || owner.key === target.key) {
      continue;
    }
    layout.edges.push({
      id: `see-also:${owner.key}:${target.key}`,
      kind: 'see-also',
      source: owner.key,
      target: target.key,
      familyId: null,
      geometry: {
        from: { x: owner.x, y: owner.y },
        to: { x: target.x, y: target.y },
      },
    });
  }
}

/**
 * Computes positions for the requested chart around `focusId`. Returns null
 * when the focus person is unknown.
 */export function layoutPedigree(
  focusId: string,
  persons: PersonRecord[],
  families: FamilyRecord[],
  options: PedigreeLayoutOptions = {},
): PedigreeLayout | null {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const nodeWidth = merged.nodeWidth;
  const nodeHeight = merged.nodeHeight;

  if (merged.kind === 'family') {
    return layoutFamilyView(focusId, persons, families, merged);
  }

  if (merged.kind === 'hourglass') {
    const up = layoutDirectional(focusId, persons, families, 'ancestors', merged);
    const down = layoutDirectional(focusId, persons, families, 'descendants', merged);
    if (!up || !down) {
      return null;
    }
    const cards = [...up.cards, ...down.cards.filter((card) => card.key !== down.focusKey)];
    const edges = [...up.edges, ...down.edges];
    addSeeAlsoEdges({ cards, edges }, [...up.seeAlso, ...down.seeAlso]);
    return { cards, edges, focusKey: up.focusKey, ...boundsOf(cards, nodeWidth, nodeHeight) };
  }

  const laid = layoutDirectional(focusId, persons, families, merged.kind, merged);
  if (!laid) {
    return null;
  }
  addSeeAlsoEdges({ cards: laid.cards, edges: laid.edges }, laid.seeAlso);
  return {
    cards: laid.cards,
    edges: laid.edges,
    focusKey: laid.focusKey,
    ...boundsOf(laid.cards, nodeWidth, nodeHeight),
  };
}

export type {
  ChartKind,
  LaidOutCard,
  PedigreeCard,
  PedigreeCardRole,
  PedigreeEdge,
  PedigreeEdgeKind,
  PedigreeLayout,
  PedigreeLayoutOptions,
  PedigreeLine,
} from './types';

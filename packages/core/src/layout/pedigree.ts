import type { FamilyRecord, PersonRecord } from '../model/types';
import { boundsOf } from './geometry';
import {
  DEFAULT_OPTIONS,
  type LaidOutCard,
  type PedigreeEdge,
  type PedigreeLayout,
  type PedigreeLayoutOptions,
} from './types';
import { layoutDirectional, type DirectionalLayout } from './directional';
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
 * The one tree layout shows ancestors above the focus and descendants below
 * it. Both directions are tidy-tree passes; they are normalised into one
 * coordinate frame so the focus card sits at (0, 0) and every edge geometry
 * matches the final card positions.
 */

/**
 * Picks a sensible default focus person: prefer a "leaf" of the descendant
 * direction — someone who is a child in some family but has no children of
 * their own (typically the youngest generation). Falls back to any child,
 * then to the first person in list order.
 */
export function suggestFocusPerson(persons: PersonRecord[], families: FamilyRecord[]): string | undefined {
  if (persons.length === 0) {
    return undefined;
  }
  const children = new Set<string>();
  const parents = new Set<string>();
  for (const family of families) {
    for (const id of family.children) {
      children.add(id);
    }
    for (const id of family.partners) {
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
        (a, b) => Math.abs(a.generation - (owner?.generation ?? 0)) - Math.abs(b.generation - (owner?.generation ?? 0)),
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

/** Shifts a directional layout horizontally, cards and edge geometry alike. */
function translateDirectional(layout: DirectionalLayout, dx: number): DirectionalLayout {
  if (dx === 0) {
    return layout;
  }
  return {
    ...layout,
    cards: layout.cards.map((card) => ({ ...card, x: card.x + dx })),
    edges: layout.edges.map((edge) => ({
      ...edge,
      geometry: {
        from: { ...edge.geometry.from, x: edge.geometry.from.x + dx },
        to: { ...edge.geometry.to, x: edge.geometry.to.x + dx },
      },
    })),
  };
}

/**
 * Computes positions for the tree around `focusId`. Returns null when the
 * focus person is unknown. Ancestors sit above the focus, descendants below;
 * both halves share the same coordinate frame with the focus at (0, 0).
 */
export function layoutPedigree(
  focusId: string,
  persons: PersonRecord[],
  families: FamilyRecord[],
  options: PedigreeLayoutOptions = {},
): PedigreeLayout | null {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const nodeWidth = merged.nodeWidth;
  const nodeHeight = merged.nodeHeight;

  const ancestors = layoutDirectional(focusId, persons, families, 'ancestors', merged);
  const descendants = layoutDirectional(focusId, persons, families, 'descendants', merged);
  if (!ancestors || !descendants) {
    return null;
  }
  const ancestorFocus = ancestors.cards.find((card) => card.key === ancestors.focusKey);
  const descendantFocus = descendants.cards.find((card) => card.key === descendants.focusKey);
  if (!ancestorFocus || !descendantFocus) {
    return null;
  }

  // One shared focus frame: translate each half so its own focus card lands
  // at x = 0, then keep the ancestor focus card (the descendant copy is the
  // same person and would otherwise overlap it). Edge geometry is translated
  // with the cards, so focus edges cannot detach.
  const up = translateDirectional(ancestors, -ancestorFocus.x);
  const down = translateDirectional(descendants, -descendantFocus.x);
  const cards = [...up.cards, ...down.cards.filter((card) => card.key !== down.focusKey)];
  const edges = [...up.edges, ...down.edges];
  addSeeAlsoEdges({ cards, edges }, [...up.seeAlso, ...down.seeAlso]);
  return { cards, edges, focusKey: up.focusKey, ...boundsOf(cards, nodeWidth, nodeHeight) };
}

export type {
  LaidOutCard,
  PedigreeCard,
  PedigreeCardRole,
  PedigreeEdge,
  PedigreeEdgeKind,
  PedigreeLayout,
  PedigreeLayoutOptions,
  PedigreeLine,
} from './types';

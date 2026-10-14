import { hierarchy, tree } from 'd3-hierarchy';
import type { FamilyRecord, PersonRecord } from '../model/types';

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
 * The d3 tidy tree (Reingold–Tilford) lays out alternating person and couple
 * slots; each couple slot is then expanded into two adjacent cards (spouses)
 * with a marriage edge between them, and a "bracket" of pedigree edges drops
 * from the couple to the children below.
 */

export type ChartDirection = 'ancestors' | 'descendants';

export type PedigreeCardRole = 'focus' | 'spouse' | 'child';

export interface PedigreeCard {
  /** Stable role-based key. */
  key: string;
  personId: string;
  role: PedigreeCardRole;
  /** Family this role belongs to; null for the focus card. */
  familyId: string | null;
  /** 0 = the focus row; each generation adds one row. */
  generation: number;
}

export type PedigreeEdgeKind = 'marriage' | 'pedigree';

export interface PedigreeEdge {
  id: string;
  kind: PedigreeEdgeKind;
  /** Card key of one endpoint. */
  source: string;
  /** Card key of the other endpoint. */
  target: string;
  /** Family the edge belongs to. */
  familyId: string | null;
  /** Exact canvas geometry of the edge (in the layout's coordinate space). */
  geometry: {
    from: { x: number; y: number };
    to: { x: number; y: number };
  };
}

export interface LaidOutCard extends PedigreeCard {
  /** Card center; x grows to the right. */
  x: number;
  /** Card center; y grows down. Ancestors sit at negative y. */
  y: number;
}

export interface PedigreeLayout {
  cards: LaidOutCard[];
  edges: PedigreeEdge[];
  focusKey: string;
  /** Bounding box around all card rects, focus centered at (0, 0). */
  width: number;
  height: number;
  /** Top-left corner of the bounding box in layout coordinates. */
  minX: number;
  minY: number;
}

export interface PedigreeLayoutOptions {
  /** Which half of the chart to draw around the focus (default 'ancestors'). */
  direction?: ChartDirection;
  /** Number of ancestor/descendant rows around the focus (default 4). */
  maxGenerations?: number;
  /** Uniform card width, must match the rendered card CSS (default 180). */
  nodeWidth?: number;
  /** Uniform card height, must match the rendered card CSS (default 64). */
  nodeHeight?: number;
  /** Horizontal gap between the two cards of a couple (default 16). */
  coupleGap?: number;
  /** Horizontal gap between neighbouring couple slots (default 24). */
  columnGap?: number;
  /** Vertical gap between card rows (default 48). */
  rowGap?: number;
}

const DEFAULT_OPTIONS: Required<PedigreeLayoutOptions> = {
  direction: 'ancestors',
  maxGenerations: 4,
  nodeWidth: 180,
  nodeHeight: 64,
  coupleGap: 16,
  columnGap: 24,
  rowGap: 48,
};

/** Fathers first, then mothers, then unknown sex — the pedigree convention. */
const SEX_ORDER: Record<string, number> = { M: 0, F: 1, U: 2 };

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

interface TreeItem {
  kind: 'person' | 'couple';
  /** Card key for person items, `couple:<familyId>` for couple items. */
  key: string;
  personId: string | null;
  familyId: string | null;
  /** Person: the card row. Couple: the junction row (owner row + 0.5). */
  row: number;
  /** Couple only: person ids to render as member cards next to the owner. */
  memberIds: string[];
  /** Couple only: the card key of the recursing person (the child below in
   *  ancestors view, the parent above in descendants view). */
  ownerKey: string | null;
  children: TreeItem[];
}

function orderMembers(ids: string[], personById: Map<string, PersonRecord>): string[] {
  return [...ids].sort((a, b) => {
    const rank = (id: string) => SEX_ORDER[personById.get(id)?.sex ?? 'U'] ?? 2;
    return rank(a) - rank(b);
  });
}

function orderChildren(ids: string[], personById: Map<string, PersonRecord>): string[] {
  return [...ids].sort((a, b) => {
    const birthA = personById.get(a)?.birth?.year;
    const birthB = personById.get(b)?.birth?.year;
    if (birthA === undefined && birthB === undefined) {
      return a.localeCompare(b);
    }
    if (birthA === undefined) {
      return 1;
    }
    if (birthB === undefined) {
      return -1;
    }
    return birthA - birthB;
  });
}

interface GraphBuilder {
  root: TreeItem;
  cards: PedigreeCard[];
}

/**
 * Builds the alternating person/couple tree for one direction, guarded
 * against ancestry cycles (`path`) and capped at `maxGenerations` rows.
 */
function buildGraph(
  focusId: string,
  persons: PersonRecord[],
  families: FamilyRecord[],
  direction: ChartDirection,
  maxGenerations: number,
): GraphBuilder | null {
  const personById = new Map(persons.map((person) => [person.id, person]));
  if (!personById.has(focusId)) {
    return null;
  }
  const sortedFamilies = [...families].sort((a, b) => a.id.localeCompare(b.id));

  const familiesByChild = new Map<string, FamilyRecord[]>();
  const familiesByParent = new Map<string, FamilyRecord[]>();
  for (const family of sortedFamilies) {
    for (const childId of family.children) {
      const list = familiesByChild.get(childId);
      if (list) {
        list.push(family);
      } else {
        familiesByChild.set(childId, [family]);
      }
    }
    for (const parentId of family.parents) {
      const list = familiesByParent.get(parentId);
      if (list) {
        list.push(family);
      } else {
        familiesByParent.set(parentId, [family]);
      }
    }
  }

  const cards: PedigreeCard[] = [];

  const buildPerson = (
    id: string,
    key: string,
    role: PedigreeCardRole,
    familyId: string | null,
    row: number,
    path: Set<string>,
  ): TreeItem => {
    cards.push({ key, personId: id, role, familyId, generation: row });
    const item: TreeItem = {
      kind: 'person',
      key,
      personId: id,
      familyId,
      row,
      memberIds: [],
      ownerKey: null,
      children: [],
    };
    if (row >= maxGenerations) {
      return item;
    }
    const nextPath = new Set(path).add(id);
    const familiesToVisit =
      direction === 'ancestors'
        ? familiesByChild.get(id) ?? []
        : familiesByParent.get(id) ?? [];

    for (const family of familiesToVisit) {
      const memberIds = orderMembers(family.parents, personById).filter(
        (memberId) => memberId !== id && personById.has(memberId) && !nextPath.has(memberId),
      );
      if (direction === 'ancestors' && memberIds.length === 0) {
        continue;
      }
      const couple: TreeItem = {
        kind: 'couple',
        key: `couple:${family.id}`,
        personId: null,
        familyId: family.id,
        row: row + 0.5,
        memberIds: memberIds.slice(0, 2),
        ownerKey: key,
        children: [],
      };
      item.children.push(couple);

      if (direction === 'ancestors') {
        for (const memberId of couple.memberIds) {
          couple.children.push(
            buildPerson(
              memberId,
              `person:${memberId}@spouse:${family.id}`,
              'spouse',
              family.id,
              row + 1,
              nextPath,
            ),
          );
        }
      } else {
        // Spouse members are terminal cards: their ancestors are not part
        // of a descendant chart.
        for (const memberId of couple.memberIds) {
          cards.push({
            key: `person:${memberId}@spouse:${family.id}`,
            personId: memberId,
            role: 'spouse',
            familyId: family.id,
            generation: row,
          });
        }
        for (const childId of orderChildren(family.children, personById)) {
          if (personById.has(childId) && !nextPath.has(childId)) {
            couple.children.push(
              buildPerson(
                childId,
                `person:${childId}@child:${family.id}`,
                'child',
                family.id,
                row + 1,
                nextPath,
              ),
            );
          }
        }
      }
    }
    return item;
  };

  const root = buildPerson(focusId, `person:${focusId}@focus`, 'focus', null, 0, new Set());
  return { root, cards };
}

/**
 * Computes tidy-tree positions for the pedigree around `focusId`. Couples
 * expand into side-by-side cards; marriage and bracket (pedigree) edges come
 * with exact geometry. Returns null when the focus person is unknown.
 */
export function layoutPedigree(
  focusId: string,
  persons: PersonRecord[],
  families: FamilyRecord[],
  options: PedigreeLayoutOptions = {},
): PedigreeLayout | null {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const built = buildGraph(focusId, persons, families, merged.direction, merged.maxGenerations);
  if (!built) {
    return null;
  }

  const personById = new Map(persons.map((person) => [person.id, person]));
  const coupleWidth = merged.nodeWidth * 2 + merged.coupleGap;
  const slotWidth = coupleWidth + merged.columnGap;
  const rowHeight = merged.nodeHeight + merged.rowGap;
  const halfStep = rowHeight / 2;
  const halfPair = (merged.nodeWidth + merged.coupleGap) / 2;
  const sign = merged.direction === 'ancestors' ? -1 : 1;

  const root = hierarchy<TreeItem>(built.root, (node) => node.children);
  const laidOut = tree<TreeItem>().nodeSize([slotWidth, halfStep])(root);

  const personByCardKey = new Map(
    built.cards.map((card) => [card.key, personById.get(card.personId)]),
  );
  const rowY = (row: number): number => (row === 0 ? 0 : sign * row * rowHeight);

  // Card positions. Person cards keep their tidy-tree column; couple member
  // cards sit in the same row, next to the couple column. Two passes: the
  // couple expansion runs second and owns the x of member cards (in the
  // ancestors direction a member card is also a person item, whose d3 column
  // only matters for the subtree layout).
  const cardX = new Map<string, number>();
  const cardY = new Map<string, number>();
  for (const laid of laidOut.descendants()) {
    if (laid.data.kind === 'person') {
      cardX.set(laid.data.key, laid.x);
      cardY.set(laid.data.key, rowY(laid.data.row));
    }
  }
  for (const laid of laidOut.descendants()) {
    if (laid.data.kind !== 'couple') {
      continue;
    }
    const memberKeys = laid.data.memberIds.map(
      (memberId) => `person:${memberId}@spouse:${laid.data.familyId ?? ''}`,
    );
    const memberRow = merged.direction === 'ancestors' ? laid.data.row + 0.5 : laid.data.row - 0.5;
    if (memberKeys.length === 0) {
      continue;
    }
    if (merged.direction === 'ancestors' || memberKeys.length > 1) {
      // Ancestors: the couple owns its column — parents flank the junction.
      // Descendants with two spouses: same flanking around the couple column.
      cardX.set(memberKeys[0] ?? '', laid.x - halfPair);
      if (memberKeys[1]) {
        cardX.set(memberKeys[1], laid.x + halfPair);
      }
    } else {
      // Descendants with one spouse: the spouse sits next to the owner's
      // card, fathers to the left of mothers.
      const owner = laid.data.ownerKey ? personByCardKey.get(laid.data.ownerKey) : undefined;
      const spouse = laid.data.memberIds[0] ? personById.get(laid.data.memberIds[0]) : undefined;
      const left = spouse?.sex === 'M' && owner?.sex !== 'M';
      cardX.set(memberKeys[0] ?? '', laid.x + (left ? -halfPair : halfPair));
    }
    for (const key of memberKeys) {
      cardY.set(key, rowY(memberRow));
    }
  }

  const cards: LaidOutCard[] = built.cards.map((card) => {
    const x = cardX.get(card.key);
    const y = cardY.get(card.key);
    if (x === undefined || y === undefined) {
      throw new Error(`missing position for card ${card.key}`);
    }
    return { ...card, x: x - laidOut.x, y };
  });

  const cardByKey = new Map(cards.map((card) => [card.key, card]));
  const edges: PedigreeEdge[] = [];
  const horizontal = (a: LaidOutCard, b: LaidOutCard) => {
    // Marriage: a short horizontal line between the inner edges of two
    // cards on the same row.
    const left = a.x <= b.x ? a : b;
    const right = a.x <= b.x ? b : a;
    return {
      from: { x: left.x + merged.nodeWidth / 2, y: left.y },
      to: { x: right.x - merged.nodeWidth / 2, y: right.y },
    };
  };
  const vertical = (parent: LaidOutCard, child: LaidOutCard) => {
    // Pedigree bracket: from the parent card's bottom edge to the child
    // card's top edge; the horizontal segment runs midway between rows.
    return {
      from: { x: parent.x, y: parent.y + merged.nodeHeight / 2 },
      to: { x: child.x, y: child.y - merged.nodeHeight / 2 },
    };
  };

  for (const laid of laidOut.descendants()) {
    if (laid.data.kind !== 'couple') {
      continue;
    }
    const memberKeys = laid.data.memberIds.map(
      (memberId) => `person:${memberId}@spouse:${laid.data.familyId ?? ''}`,
    );
    const memberCards = memberKeys
      .map((key) => cardByKey.get(key))
      .filter((card): card is LaidOutCard => card !== undefined);
    const ownerCard = laid.data.ownerKey ? cardByKey.get(laid.data.ownerKey) : undefined;
    const familyId = laid.data.familyId;
    const addEdge = (source: LaidOutCard, target: LaidOutCard, kind: PedigreeEdgeKind) => {
      const geometry =
        kind === 'marriage' ? horizontal(source, target) : vertical(source, target);
      edges.push({
        id: `${kind}:${familyId ?? ''}:${source.key}:${target.key}`,
        kind,
        source: source.key,
        target: target.key,
        familyId,
        geometry,
      });
    };

    if (merged.direction === 'ancestors') {
      if (memberCards.length === 2) {
        addEdge(memberCards[0]!, memberCards[1]!, 'marriage');
      }
      for (const memberCard of memberCards) {
        if (ownerCard) {
          addEdge(memberCard, ownerCard, 'pedigree');
        }
      }
      continue;
    }
    // Descendants: marriage edges from the owner to each spouse card, and
    // pedigree edges from every parent card to every child card.
    for (const spouseCard of memberCards) {
      if (ownerCard) {
        addEdge(ownerCard, spouseCard, 'marriage');
      }
    }
    const childCards = laid.data.children
      .map((child) => (child.kind === 'person' ? cardByKey.get(child.key) : undefined))
      .filter((card): card is LaidOutCard => card !== undefined);
    const parentCards = [ownerCard, ...memberCards].filter(
      (card): card is LaidOutCard => card !== undefined,
    );
    for (const parentCard of parentCards) {
      for (const childCard of childCards) {
        addEdge(parentCard, childCard, 'pedigree');
      }
    }
  }

  const minX = Math.min(...cards.map((card) => card.x)) - merged.nodeWidth / 2;
  const maxX = Math.max(...cards.map((card) => card.x)) + merged.nodeWidth / 2;
  const minY = Math.min(...cards.map((card) => card.y)) - merged.nodeHeight / 2;
  const maxY = Math.max(...cards.map((card) => card.y)) + merged.nodeHeight / 2;

  return {
    cards,
    edges,
    focusKey: built.root.key,
    width: maxX - minX,
    height: maxY - minY,
    minX,
    minY,
  };
}

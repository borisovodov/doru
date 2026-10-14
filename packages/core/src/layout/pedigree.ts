import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy';
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
 * Four chart kinds share the same building blocks:
 * - ancestors / descendants: alternating person/couple tidy trees around the
 *   focus, one direction each;
 * - hourglass: ancestors and descendants merged at the focus;
 * - family: the focus couple with children below and both sides' parents
 *   above (laid out directly, the graph is only two rows deep).
 */

export type ChartKind = 'ancestors' | 'descendants' | 'hourglass' | 'family';

/** Which side of the focus an ancestor card sits on. */
export type PedigreeLine = 'paternal' | 'maternal' | null;

export type PedigreeCardRole = 'focus' | 'spouse' | 'child';

export interface PedigreeCard {
  /** Stable role-based key. */
  key: string;
  personId: string;
  role: PedigreeCardRole;
  /** Family this role belongs to; null for the focus card. */
  familyId: string | null;
  /** 0 = the focus row; each generation adds one row (negative rows sit above). */
  generation: number;
  /** Father's side / mother's side in ancestor charts; null elsewhere. */
  line: PedigreeLine;
  /** Whether the card has a collapsible subtree above/below it. */
  hasSubtree: boolean;
}

export type PedigreeEdgeKind = 'marriage' | 'pedigree' | 'see-also';

export interface PedigreeEdge {
  id: string;
  kind: PedigreeEdgeKind;
  /** Card key of one endpoint. */
  source: string;
  /** Card key of the other endpoint. */
  target: string;
  /** Family the edge belongs to; null for see-also links. */
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
  /** Which chart to draw around the focus (default 'ancestors'). */
  kind?: ChartKind;
  /** Number of ancestor/descendant rows around the focus (default 4). */
  maxGenerations?: number;
  /** Person ids whose subtrees are collapsed (cards stay, branches hide). */
  collapsed?: ReadonlySet<string>;
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
  kind: 'ancestors',
  maxGenerations: 4,
  collapsed: new Set<string>(),
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

interface SeeAlso {
  ownerKey: string;
  personId: string;
}

interface GraphBuilder {
  root: TreeItem;
  cards: PedigreeCard[];
  seeAlso: SeeAlso[];
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

/**
 * Whether `ancestorId` sits on the ancestry chain above `personId` (i.e.
 * `personId` descends from `ancestorId`). Used to reject reparenting that
 * would create an ancestry cycle.
 */
export function isDescendantOf(
  persons: PersonRecord[],
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

function indexFamilies(
  families: FamilyRecord[],
): { byChild: Map<string, FamilyRecord[]>; byParent: Map<string, FamilyRecord[]> } {
  const sortedFamilies = [...families].sort((a, b) => a.id.localeCompare(b.id));
  const byChild = new Map<string, FamilyRecord[]>();
  const byParent = new Map<string, FamilyRecord[]>();
  for (const family of sortedFamilies) {
    for (const childId of family.children) {
      const list = byChild.get(childId);
      if (list) {
        list.push(family);
      } else {
        byChild.set(childId, [family]);
      }
    }
    for (const parentId of family.parents) {
      const list = byParent.get(parentId);
      if (list) {
        list.push(family);
      } else {
        byParent.set(parentId, [family]);
      }
    }
  }
  return { byChild, byParent };
}

/**
 * Builds the alternating person/couple tree for one direction, guarded
 * against ancestry cycles (`path`) and capped at `maxGenerations` rows.
 */
function buildDirectionalGraph(
  focusId: string,
  persons: PersonRecord[],
  families: FamilyRecord[],
  direction: 'ancestors' | 'descendants',
  maxGenerations: number,
  collapsed: ReadonlySet<string>,
): GraphBuilder | null {
  const personById = new Map(persons.map((person) => [person.id, person]));
  if (!personById.has(focusId)) {
    return null;
  }
  const { byChild, byParent } = indexFamilies(families);
  const cards: PedigreeCard[] = [];
  const seeAlso: SeeAlso[] = [];

  const buildPerson = (
    id: string,
    key: string,
    role: PedigreeCardRole,
    familyId: string | null,
    row: number,
    line: PedigreeLine,
    path: Set<string>,
  ): TreeItem => {
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
    if (row >= maxGenerations || collapsed.has(id)) {
      cards.push({ key, personId: id, role, familyId, generation: row, line, hasSubtree: false });
      return item;
    }
    const nextPath = new Set(path).add(id);
    const familiesToVisit =
      direction === 'ancestors' ? byChild.get(id) ?? [] : byParent.get(id) ?? [];

    for (const family of familiesToVisit) {
      const memberIds = orderMembers(family.parents, personById).filter(
        (memberId) => memberId !== id && personById.has(memberId),
      );
      let members: string[];
      if (direction === 'ancestors') {
        for (const skipped of memberIds.filter((memberId) => nextPath.has(memberId))) {
          seeAlso.push({ ownerKey: key, personId: skipped });
        }
        members = memberIds.filter((memberId) => !nextPath.has(memberId)).slice(0, 2);
        if (members.length === 0) {
          continue;
        }
      } else {
        // Spouse members stay visible even when they are also ancestors of
        // the focus (a cycle in the data): they are terminal cards.
        members = memberIds.slice(0, 2);
      }
      const couple: TreeItem = {
        kind: 'couple',
        key: `couple:${family.id}`,
        personId: null,
        familyId: family.id,
        row: row + 0.5,
        memberIds: members,
        ownerKey: key,
        children: [],
      };
      item.children.push(couple);

      if (direction === 'ancestors') {
        couple.memberIds.forEach((memberId, index) => {
          couple.children.push(
            buildPerson(
              memberId,
              `person:${memberId}@spouse:${family.id}`,
              'spouse',
              family.id,
              row + 1,
              line ?? (index === 0 ? 'paternal' : 'maternal'),
              nextPath,
            ),
          );
        });
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
            line: null,
            hasSubtree: false,
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
                null,
                nextPath,
              ),
            );
          } else if (nextPath.has(childId)) {
            seeAlso.push({ ownerKey: key, personId: childId });
          }
        }
      }
    }
    cards.push({ key, personId: id, role, familyId, generation: row, line, hasSubtree: item.children.length > 0 });
    return item;
  };

  const root = buildPerson(focusId, `person:${focusId}@focus`, 'focus', null, 0, null, new Set());
  return { root, cards, seeAlso };
}

interface DirectionalLayout {
  cards: LaidOutCard[];
  edges: PedigreeEdge[];
  focusKey: string;
  seeAlso: SeeAlso[];
}

/**
 * Tidy-tree positions for one direction. The focus lands at (0, 0);
 * ancestors sit at negative y, descendants at positive y.
 */
function layoutDirectional(
  focusId: string,
  persons: PersonRecord[],
  families: FamilyRecord[],
  direction: 'ancestors' | 'descendants',
  merged: Required<PedigreeLayoutOptions>,
): DirectionalLayout | null {
  const built = buildDirectionalGraph(
    focusId,
    persons,
    families,
    direction,
    merged.maxGenerations,
    merged.collapsed,
  );
  if (!built) {
    return null;
  }

  const personById = new Map(persons.map((person) => [person.id, person]));
  const coupleWidth = merged.nodeWidth * 2 + merged.coupleGap;
  const slotWidth = coupleWidth + merged.columnGap;
  const rowHeight = merged.nodeHeight + merged.rowGap;
  const halfStep = rowHeight / 2;
  const halfPair = (merged.nodeWidth + merged.coupleGap) / 2;
  const sign = direction === 'ancestors' ? -1 : 1;

  const personByCardKey = new Map(
    built.cards.map((card) => [card.key, personById.get(card.personId)]),
  );
  const rowY = (row: number): number => (row === 0 ? 0 : sign * row * rowHeight);

  const root = hierarchy<TreeItem>(built.root, (node) => node.children);
  const laidOut = tree<TreeItem>().nodeSize([slotWidth, halfStep])(root);

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
  // Couples of one owner, in left-to-right tree order: used to place
  // spouse cards without overlapping the owner card.
  const couplesByOwner = new Map<string, HierarchyPointNode<TreeItem>[]>();
  for (const laid of laidOut.descendants()) {
    if (laid.data.kind === 'couple' && laid.data.ownerKey) {
      const list = couplesByOwner.get(laid.data.ownerKey) ?? [];
      list.push(laid);
      couplesByOwner.set(laid.data.ownerKey, list);
    }
  }
  const spouseSpacing = merged.nodeWidth + merged.coupleGap;

  for (const laid of laidOut.descendants()) {
    if (laid.data.kind !== 'couple') {
      continue;
    }
    const memberKeys = laid.data.memberIds.map(
      (memberId) => `person:${memberId}@spouse:${laid.data.familyId ?? ''}`,
    );
    const memberRow = direction === 'ancestors' ? laid.data.row + 0.5 : laid.data.row - 0.5;
    if (memberKeys.length === 0) {
      continue;
    }
    if (direction === 'ancestors' || memberKeys.length > 1) {
      // Ancestors: the couple owns its column — parents flank the junction.
      // Descendants with two spouses: flank the owner card further out.
      const offset = direction === 'ancestors' ? halfPair : spouseSpacing;
      cardX.set(memberKeys[0] ?? '', laid.x - offset);
      if (memberKeys[1]) {
        cardX.set(memberKeys[1], laid.x + offset);
      }
    } else if (direction === 'descendants') {
      const ownerKey = laid.data.ownerKey ?? '';
      const ownerList = couplesByOwner.get(ownerKey) ?? [];
      const owner = ownerKey ? personByCardKey.get(ownerKey) : undefined;
      const spouse = laid.data.memberIds[0] ? personById.get(laid.data.memberIds[0]) : undefined;
      if (ownerList.length === 1) {
        // One couple: the pair is centered on the couple column, fathers
        // to the left of mothers.
        const left = spouse?.sex === 'M' && owner?.sex !== 'M';
        cardX.set(ownerKey, laid.x + (left ? halfPair : -halfPair));
        cardX.set(memberKeys[0] ?? '', laid.x + (left ? -halfPair : halfPair));
      } else {
        // Several couples: the owner keeps its own column; each spouse sits
        // next to the owner on the side of their couple column.
        const ownerX = cardX.get(ownerKey);
        if (ownerX !== undefined) {
          const side = laid.x - ownerX >= 0 ? 1 : -1;
          cardX.set(memberKeys[0] ?? '', ownerX + side * spouseSpacing);
        }
      }
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
    const left = a.x <= b.x ? a : b;
    const right = a.x <= b.x ? b : a;
    return {
      from: { x: left.x + merged.nodeWidth / 2, y: left.y },
      to: { x: right.x - merged.nodeWidth / 2, y: right.y },
    };
  };
  const vertical = (parent: LaidOutCard, child: LaidOutCard) => ({
    from: { x: parent.x, y: parent.y + merged.nodeHeight / 2 },
    to: { x: child.x, y: child.y - merged.nodeHeight / 2 },
  });
  const addEdge = (
    source: LaidOutCard,
    target: LaidOutCard,
    kind: PedigreeEdgeKind,
    familyId: string | null,
  ) => {
    const geometry = kind === 'marriage' ? horizontal(source, target) : vertical(source, target);
    edges.push({
      id: `${kind}:${direction}:${familyId ?? ''}:${source.key}:${target.key}`,
      kind,
      source: source.key,
      target: target.key,
      familyId,
      geometry,
    });
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

    if (direction === 'ancestors') {
      if (memberCards.length === 2) {
        addEdge(memberCards[0]!, memberCards[1]!, 'marriage', familyId);
      }
      for (const memberCard of memberCards) {
        if (ownerCard) {
          addEdge(memberCard, ownerCard, 'pedigree', familyId);
        }
      }
      continue;
    }
    for (const spouseCard of memberCards) {
      if (ownerCard) {
        addEdge(ownerCard, spouseCard, 'marriage', familyId);
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
        addEdge(parentCard, childCard, 'pedigree', familyId);
      }
    }
  }

  return { cards, edges, focusKey: built.root.key, seeAlso: built.seeAlso };
}

function boundsOf(
  cards: LaidOutCard[],
  nodeWidth: number,
  nodeHeight: number,
): { width: number; height: number; minX: number; minY: number } {
  const minX = Math.min(...cards.map((card) => card.x)) - nodeWidth / 2;
  const maxX = Math.max(...cards.map((card) => card.x)) + nodeWidth / 2;
  const minY = Math.min(...cards.map((card) => card.y)) - nodeHeight / 2;
  const maxY = Math.max(...cards.map((card) => card.y)) + nodeHeight / 2;
  return { width: maxX - minX, height: maxY - minY, minX, minY };
}

function addSeeAlsoEdges(
  layout: { cards: LaidOutCard[]; edges: PedigreeEdge[] },
  seeAlso: SeeAlso[],
): void {
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
 * The focus couple with children below and the parents of both spouses
 * above. The graph is shallow (three rows), so it is laid out directly
 * instead of running the tidy tree.
 */
function layoutFamilyView(
  focusId: string,
  persons: PersonRecord[],
  families: FamilyRecord[],
  merged: Required<PedigreeLayoutOptions>,
): PedigreeLayout | null {
  const personById = new Map(persons.map((person) => [person.id, person]));
  if (!personById.has(focusId)) {
    return null;
  }
  const { byChild, byParent } = indexFamilies(families);
  const cards: LaidOutCard[] = [];
  const edges: PedigreeEdge[] = [];
  const nodeWidth = merged.nodeWidth;
  const nodeHeight = merged.nodeHeight;
  const coupleWidth = nodeWidth * 2 + merged.coupleGap;
  const halfPair = (nodeWidth + merged.coupleGap) / 2;
  const rowHeight = nodeHeight + merged.rowGap;

  const horizontal = (a: LaidOutCard, b: LaidOutCard) => {
    const left = a.x <= b.x ? a : b;
    const right = a.x <= b.x ? b : a;
    return {
      from: { x: left.x + nodeWidth / 2, y: left.y },
      to: { x: right.x - nodeWidth / 2, y: right.y },
    };
  };
  const vertical = (parent: LaidOutCard, child: LaidOutCard) => ({
    from: { x: parent.x, y: parent.y + nodeHeight / 2 },
    to: { x: child.x, y: child.y - nodeHeight / 2 },
  });
  const addEdge = (
    source: LaidOutCard,
    target: LaidOutCard,
    kind: PedigreeEdgeKind,
    familyId: string | null,
  ) => {
    const geometry = kind === 'marriage' ? horizontal(source, target) : vertical(source, target);
    edges.push({
      id: `${kind}:family:${familyId ?? ''}:${source.key}:${target.key}`,
      kind,
      source: source.key,
      target: target.key,
      familyId,
      geometry,
    });
  };

  const focusCard: LaidOutCard = {
    key: `person:${focusId}@focus`,
    personId: focusId,
    role: 'focus',
    familyId: null,
    generation: 0,
    line: null,
    hasSubtree: false,
    x: 0,
    y: 0,
  };
  cards.push(focusCard);

  // Row 0: spouses of the focus, flanks alternating right/left.
  const focusFamilies = byParent.get(focusId) ?? [];
  const spouseEntries: Array<{ spouseId: string; key: string; familyId: string }> = [];
  const childEntries: Array<{ childId: string; key: string; familyId: string }> = [];
  for (const family of focusFamilies) {
    const spouses = orderMembers(family.parents, personById)
      .filter((id) => id !== focusId && personById.has(id))
      .slice(0, 2);
    for (const spouseId of spouses) {
      spouseEntries.push({
        spouseId,
        key: `person:${spouseId}@spouse:${family.id}`,
        familyId: family.id,
      });
    }
    for (const childId of orderChildren(family.children, personById)) {
      if (personById.has(childId)) {
        childEntries.push({
          childId,
          key: `person:${childId}@child:${family.id}`,
          familyId: family.id,
        });
      }
    }
  }
  const spouseByKey = new Map<string, LaidOutCard>();
  const spouseSpacing = nodeWidth + merged.coupleGap;
  if (spouseEntries.length === 1) {
    // One spouse: the couple is centered on the focus, fathers left.
    const spouse = personById.get(spouseEntries[0]!.spouseId);
    const left = spouse?.sex === 'M' && personById.get(focusId)?.sex !== 'M';
    focusCard.x = left ? halfPair : -halfPair;
    const card: LaidOutCard = {
      key: spouseEntries[0]!.key,
      personId: spouseEntries[0]!.spouseId,
      role: 'spouse',
      familyId: spouseEntries[0]!.familyId,
      generation: 0,
      line: null,
      hasSubtree: false,
      x: left ? -halfPair : halfPair,
      y: 0,
    };
    cards.push(card);
    spouseByKey.set(card.key, card);
    addEdge(focusCard, card, 'marriage', card.familyId);
  } else {
    spouseEntries.forEach((entry, index) => {
      const card: LaidOutCard = {
        key: entry.key,
        personId: entry.spouseId,
        role: 'spouse',
        familyId: entry.familyId,
        generation: 0,
        line: null,
        hasSubtree: false,
        x: index % 2 === 0 ? spouseSpacing : -spouseSpacing,
        y: 0,
      };
      cards.push(card);
      spouseByKey.set(entry.key, card);
      addEdge(focusCard, card, 'marriage', entry.familyId);
    });
  }

  // Row -1: parent couples of the focus, then of each spouse, side by side.
  interface ParentBlock {
    members: string[];
    familyId: string;
    ownerKey: string | null;
    /** Focus's own parents get paternal/maternal lines. */
    focusLine: boolean;
  }
  const blocks: ParentBlock[] = [];
  for (const family of byChild.get(focusId) ?? []) {
    const members = orderMembers(family.parents, personById)
      .filter((id) => id !== focusId && personById.has(id))
      .slice(0, 2);
    if (members.length > 0) {
      blocks.push({ members, familyId: family.id, ownerKey: focusCard.key, focusLine: true });
    }
  }
  for (const entry of spouseEntries) {
    for (const family of byChild.get(entry.spouseId) ?? []) {
      if (family.id === entry.familyId) {
        continue;
      }
      const members = orderMembers(family.parents, personById)
        .filter((id) => id !== entry.spouseId && personById.has(id))
        .slice(0, 2);
      if (members.length > 0) {
        blocks.push({
          members,
          familyId: family.id,
          ownerKey: entry.key,
          focusLine: false,
        });
      }
    }
  }
  const blockWidth = (block: ParentBlock) => (block.members.length > 1 ? coupleWidth : nodeWidth);
  const totalWidth =
    blocks.reduce((sum, block) => sum + blockWidth(block), 0) +
    merged.columnGap * Math.max(0, blocks.length - 1);
  let cursor = -totalWidth / 2;
  for (const block of blocks) {
    const width = blockWidth(block);
    const center = cursor + width / 2;
    const memberCards: LaidOutCard[] = [];
    block.members.forEach((memberId, index) => {
      const card: LaidOutCard = {
        key: `person:${memberId}@spouse:${block.familyId}`,
        personId: memberId,
        role: 'spouse',
        familyId: block.familyId,
        generation: -1,
        line: block.focusLine ? (index === 0 ? 'paternal' : 'maternal') : null,
        hasSubtree: false,
        x: block.members.length > 1 ? center + (index === 0 ? -halfPair : halfPair) : center,
        y: -rowHeight,
      };
      cards.push(card);
      memberCards.push(card);
    });
    if (memberCards.length === 2) {
      addEdge(memberCards[0]!, memberCards[1]!, 'marriage', block.familyId);
    }
    const ownerCard = cardByKeySafe(cards, block.ownerKey);
    if (ownerCard) {
      for (const memberCard of memberCards) {
        addEdge(memberCard, ownerCard, 'pedigree', block.familyId);
      }
    }
    cursor += width + merged.columnGap;
  }

  // Row +1: all children, ordered by family then birth, centered on the focus.
  const childCount = childEntries.length;
  if (childCount > 0) {
    const childrenWidth = childCount * nodeWidth + (childCount - 1) * merged.columnGap;
    let childX = -childrenWidth / 2;
    const childByKey = new Map<string, LaidOutCard>();
    for (const entry of childEntries) {
      const card: LaidOutCard = {
        key: entry.key,
        personId: entry.childId,
        role: 'child',
        familyId: entry.familyId,
        generation: 1,
        line: null,
        hasSubtree: false,
        x: childX + nodeWidth / 2,
        y: rowHeight,
      };
      cards.push(card);
      childByKey.set(entry.key, card);
      childX += nodeWidth + merged.columnGap;
    }
    for (const entry of childEntries) {
      const childCard = childByKey.get(entry.key);
      if (!childCard) {
        continue;
      }
      addEdge(focusCard, childCard, 'pedigree', entry.familyId);
      for (const spouseEntry of spouseEntries) {
        if (spouseEntry.familyId === entry.familyId) {
          const spouseCard = spouseByKey.get(spouseEntry.key);
          if (spouseCard) {
            addEdge(spouseCard, childCard, 'pedigree', entry.familyId);
          }
        }
      }
    }
  }

  return { cards, edges, focusKey: focusCard.key, ...boundsOf(cards, nodeWidth, nodeHeight) };
}

function cardByKeySafe(cards: LaidOutCard[], key: string | null): LaidOutCard | undefined {
  return key === null ? undefined : cards.find((card) => card.key === key);
}

/**
 * Computes positions for the requested chart around `focusId`. Returns null
 * when the focus person is unknown.
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

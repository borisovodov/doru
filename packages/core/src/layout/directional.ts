import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy';
import type { FamilyRecord, PersonRecord } from '../model/types';
import type { LaidOutCard, PedigreeEdge, PedigreeEdgeKind, PedigreeLayoutOptions } from './types';
import { buildDirectionalGraph, type SeeAlso, type TreeItem } from './graph';

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
export function layoutDirectional(
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


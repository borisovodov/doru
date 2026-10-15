import type { FamilyRecord, PersonRecord } from '../model/types';
import type { LaidOutCard, PedigreeEdge, PedigreeEdgeKind, PedigreeLayout, PedigreeLayoutOptions } from './types';
import { boundsOf } from './geometry';
import { indexFamilies, orderChildren, orderMembers } from './graph';

export function layoutFamilyView(
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

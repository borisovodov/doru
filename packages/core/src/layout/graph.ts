import type { FamilyRecord, PersonRecord } from '../model/types';
import { SEX_ORDER } from './types';
import type { PedigreeCard, PedigreeLine, PedigreeCardRole } from './types';

export interface TreeItem {
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

export interface SeeAlso {
  ownerKey: string;
  personId: string;
}

export interface GraphBuilder {
  root: TreeItem;
  cards: PedigreeCard[];
  seeAlso: SeeAlso[];
}

export function orderMembers(ids: string[], personById: Map<string, PersonRecord>): string[] {
  return [...ids].sort((a, b) => {
    const rank = (id: string) => SEX_ORDER[personById.get(id)?.sex ?? 'U'] ?? 2;
    return rank(a) - rank(b);
  });
}

export function orderChildren(ids: string[], personById: Map<string, PersonRecord>): string[] {
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

export function indexFamilies(
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
export function buildDirectionalGraph(
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


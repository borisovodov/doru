import type { TreeRepository } from './db/repository';

export interface PedigreeNode {
  id: string;
  parents: PedigreeNode[];
}

export function computePedigree(repo: TreeRepository, personId: string, generations = 5): PedigreeNode | undefined {
  if (!repo.getPerson(personId)) {
    return undefined;
  }
  const families = repo.listFamilies();
  const parentsByChild = new Map<string, string[]>();
  for (const family of families) {
    for (const childId of family.children) {
      const parents = family.partners.filter((partnerId) => partnerId !== childId);
      if (parents.length > 0) {
        parentsByChild.set(childId, parents);
      }
    }
  }
  const visited = new Set<string>([personId]);
  return build(personId, generations, parentsByChild, visited);
}

function build(
  id: string,
  generations: number,
  parentsByChild: Map<string, string[]>,
  visited: Set<string>,
): PedigreeNode {
  const node: PedigreeNode = { id, parents: [] };
  if (generations <= 0) {
    return node;
  }
  for (const parentId of parentsByChild.get(id) ?? []) {
    if (visited.has(parentId)) {
      continue;
    }
    visited.add(parentId);
    node.parents.push(build(parentId, generations - 1, parentsByChild, visited));
  }
  return node;
}

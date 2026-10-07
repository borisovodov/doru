import type { TreeRepository } from './db/repository';

export interface PedigreeNode {
  id: string;
  parents: PedigreeNode[];
}

export function computePedigree(
  repo: TreeRepository,
  personId: string,
  generations = 5,
): PedigreeNode | undefined {
  const person = repo.getPerson(personId);
  if (!person) {
    return undefined;
  }
  const visited = new Set<string>([personId]);
  return build(repo, personId, generations, visited);
}

function build(repo: TreeRepository, id: string, generations: number, visited: Set<string>): PedigreeNode {
  const node: PedigreeNode = { id, parents: [] };
  if (generations <= 0) {
    return node;
  }
  const parentIds = new Set<string>();
  for (const family of repo.listFamilies()) {
    if (family.children.includes(id)) {
      for (const parentId of family.parents) {
        if (parentId !== id) {
          parentIds.add(parentId);
        }
      }
    }
  }
  for (const parentId of parentIds) {
    if (visited.has(parentId)) {
      continue;
    }
    visited.add(parentId);
    node.parents.push(build(repo, parentId, generations - 1, visited));
  }
  return node;
}

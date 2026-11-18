import type { TreeDocument } from '../model/types';

export interface ValidationIssue {
  kind: string;
  message: string;
  ids: string[];
}

export function detectParentCycles(doc: TreeDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const done = new Set<string>();

  const parentsOf = (id: string): string[] => {
    const result: string[] = [];
    for (const family of doc.families.values()) {
      const link = family.childLinks?.find((entry) => entry.childId === id);
      // A disproven child link does not establish ancestry.
      if (family.children.includes(id) && link?.status !== 'disproven') {
        result.push(...family.partners);
      }
    }
    return result;
  };

  const visit = (id: string, path: string[]): void => {
    const next = path.indexOf(id);
    if (next !== -1) {
      const cycle = [...path.slice(next), id];
      issues.push({
        kind: 'person.cycle',
        message: `Cycle detected: ${cycle.join(' -> ')}`,
        ids: cycle,
      });
      return;
    }
    if (done.has(id)) {
      return;
    }
    done.add(id);
    for (const parent of parentsOf(id)) {
      visit(parent, [...path, id]);
    }
  };

  for (const id of doc.persons.keys()) {
    visit(id, []);
  }
  return issues;
}

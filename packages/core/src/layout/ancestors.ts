import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy';
import type { FamilyRecord, PersonRecord } from '../model/types';

/**
 * Pedigree layout: pure functions that turn the domain model
 * (persons + families) into canvas coordinates. No DOM, no React — this is
 * the domain core of the tree editor and stays testable in isolation.
 *
 * Genealogy is a DAG (second marriages, pedigree collapse), so the graph is
 * turned into a tree by duplicating a person per family role. Every node key
 * is role-based and therefore stable across refocuses: `person:<id>@focus`
 * or `person:<id>@parent:<familyId>`.
 */

export type PedigreeRole = 'focus' | 'parent';

export interface PedigreeGraphNode {
  /** Stable role-based key. */
  key: string;
  personId: string;
  /** The family through which this node is a child of the next generation; null for the focus. */
  familyId: string | null;
  /** 0 = focus person, 1 = parents, 2 = grandparents, ... */
  generation: number;
}

export interface PedigreeGraphEdge {
  id: string;
  /** Parent node key. */
  source: string;
  /** Child node key. */
  target: string;
}

export interface PedigreeGraph {
  nodes: PedigreeGraphNode[];
  edges: PedigreeGraphEdge[];
  focusKey: string;
}

export interface LaidOutNode extends PedigreeGraphNode {
  /** Node center; x grows to the right. */
  x: number;
  /** Node center; y grows down, so ancestors sit at negative y. */
  y: number;
}

export interface AncestorLayout {
  nodes: LaidOutNode[];
  edges: PedigreeGraphEdge[];
  focusKey: string;
  /** Bounding box around all node rects, focus centered at (0, 0). */
  width: number;
  height: number;
}

export interface AncestorLayoutOptions {
  /** Number of ancestor generations above the focus person (default 4). */
  maxGenerations?: number;
  /** Uniform card size, must match the rendered card CSS (default 180). */
  nodeWidth?: number;
  /** Uniform card height, must match the rendered card CSS (default 64). */
  nodeHeight?: number;
  /** Horizontal gap between sibling cards (default 24). */
  columnGap?: number;
  /** Vertical gap between generations (default 48). */
  rowGap?: number;
}

const DEFAULT_OPTIONS: Required<AncestorLayoutOptions> = {
  maxGenerations: 4,
  nodeWidth: 180,
  nodeHeight: 64,
  columnGap: 24,
  rowGap: 48,
};

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

interface NestedNode {
  personId: string;
  key: string;
  familyId: string | null;
  generation: number;
  /** Parents, one generation up. */
  children: NestedNode[];
}

/** Fathers first, then mothers, then unknown sex — the pedigree convention. */
const SEX_ORDER: Record<string, number> = { M: 0, F: 1, U: 2 };

function orderParents(
  family: FamilyRecord,
  personById: Map<string, PersonRecord>,
): string[] {
  return [...family.parents].sort((a, b) => {
    const rank = (id: string) => SEX_ORDER[personById.get(id)?.sex ?? 'U'] ?? 2;
    return rank(a) - rank(b);
  });
}

/**
 * Turns the ancestor DAG of `focusId` into a tree with role-based keys.
 * Returns null when the focus person is unknown.
 */
export function buildAncestorGraph(
  focusId: string,
  persons: PersonRecord[],
  families: FamilyRecord[],
  options: Pick<AncestorLayoutOptions, 'maxGenerations'> = {},
): PedigreeGraph | null {
  const { maxGenerations } = { ...DEFAULT_OPTIONS, ...options };
  if (!persons.some((person) => person.id === focusId)) {
    return null;
  }

  const personById = new Map(persons.map((person) => [person.id, person]));
  // Families where the person is a child, ordered deterministically.
  const familiesByChild = new Map<string, FamilyRecord[]>();
  for (const family of [...families].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const childId of family.children) {
      const list = familiesByChild.get(childId);
      if (list) {
        list.push(family);
      } else {
        familiesByChild.set(childId, [family]);
      }
    }
  }

  const nodes: PedigreeGraphNode[] = [];
  const edges: PedigreeGraphEdge[] = [];

  const addEdge = (parent: NestedNode, child: NestedNode) => {
    edges.push({ id: `${parent.key}->${child.key}`, source: parent.key, target: child.key });
  };

  const build = (id: string, generation: number, familyId: string | null, path: Set<string>): NestedNode => {
    const key = familyId === null ? `person:${id}@focus` : `person:${id}@parent:${familyId}`;
    const nested: NestedNode = { personId: id, key, familyId, generation, children: [] };
    nodes.push({ key, personId: id, familyId, generation });
    if (generation >= maxGenerations) {
      return nested;
    }
    const nextPath = new Set(path).add(id);
    for (const family of familiesByChild.get(id) ?? []) {
      for (const parentId of orderParents(family, personById)) {
        if (parentId === id || nextPath.has(parentId) || !personById.has(parentId)) {
          continue;
        }
        const parent = build(parentId, generation + 1, family.id, nextPath);
        nested.children.push(parent);
        addEdge(parent, nested);
      }
    }
    return nested;
  };

  const root = build(focusId, 0, null, new Set());
  return { nodes, edges, focusKey: root.key };
}

/**
 * Computes tidy-tree (Reingold–Tilford) positions for the ancestor graph.
 * The focus person lands at (0, 0), ancestors fan out above.
 */
export function layoutAncestors(
  focusId: string,
  persons: PersonRecord[],
  families: FamilyRecord[],
  options: AncestorLayoutOptions = {},
): AncestorLayout | null {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const graph = buildAncestorGraph(focusId, persons, families, merged);
  if (!graph) {
    return null;
  }

  // Rebuild the nested structure from the flat graph for d3-hierarchy.
  const byKey = new Map(graph.nodes.map((node) => [node.key, node]));
  const childrenByKey = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = childrenByKey.get(edge.target);
    if (list) {
      list.push(edge.source);
    } else {
      childrenByKey.set(edge.target, [edge.source]);
    }
  }
  const toNested = (key: string): NestedNode => {
    const node = byKey.get(key);
    if (!node) {
      throw new Error(`missing node for key ${key}`);
    }
    return {
      personId: node.personId,
      key: node.key,
      familyId: node.familyId,
      generation: node.generation,
      children: (childrenByKey.get(key) ?? []).map(toNested),
    };
  };

  const root = hierarchy<NestedNode>(toNested(graph.focusKey), (node) => node.children);
  const laidOut = tree<NestedNode>().nodeSize([
    merged.nodeWidth + merged.columnGap,
    merged.nodeHeight + merged.rowGap,
  ])(root);

  const laidByKey = new Map<string, HierarchyPointNode<NestedNode>>(
    laidOut.descendants().map((laid) => [laid.data.key, laid]),
  );
  const nodes: LaidOutNode[] = graph.nodes.map((node) => {
    const laid = laidByKey.get(node.key);
    if (!laid) {
      throw new Error(`missing layout for key ${node.key}`);
    }
    return {
      ...node,
      x: laid.x - laidOut.x,
      y: laid.y === 0 ? 0 : -laid.y,
    };
  });

  const minX = Math.min(...nodes.map((node) => node.x)) - merged.nodeWidth / 2;
  const maxX = Math.max(...nodes.map((node) => node.x)) + merged.nodeWidth / 2;
  const minY = Math.min(...nodes.map((node) => node.y)) - merged.nodeHeight / 2;
  const maxY = Math.max(...nodes.map((node) => node.y)) + merged.nodeHeight / 2;

  return {
    nodes,
    edges: graph.edges,
    focusKey: graph.focusKey,
    width: maxX - minX,
    height: maxY - minY,
  };
}

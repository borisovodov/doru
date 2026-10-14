import { describe, expect, it } from 'vitest';
import { buildAncestorGraph, layoutAncestors, suggestFocusPerson, type LaidOutNode } from '../src/layout/ancestors';
import type { FamilyRecord, PersonRecord } from '../src/model/types';

const person = (id: string, sex: PersonRecord['sex'] = 'U', birthYear?: number): PersonRecord => ({
  id,
  names: [{ given: id }],
  sex,
  ...(birthYear !== undefined ? { birth: { year: birthYear, quality: 'exact' } } : {}),
});

const family = (id: string, parents: string[], children: string[]): FamilyRecord => ({
  id,
  parents,
  children,
});

describe('buildAncestorGraph', () => {
  it('walks parents through family links with role-based keys', () => {
    const persons = [person('child'), person('father', 'M'), person('mother', 'F')];
    const families = [family('F1', ['father', 'mother'], ['child'])];

    const graph = buildAncestorGraph('child', persons, families, { maxGenerations: 2 });
    expect(graph?.focusKey).toBe('person:child@focus');
    const byPerson = new Map(graph?.nodes.map((node) => [node.personId, node]));
    expect(byPerson.get('father')?.key).toBe('person:father@parent:F1');
    expect(byPerson.get('mother')?.key).toBe('person:mother@parent:F1');
    expect(byPerson.get('father')?.generation).toBe(1);
    // Fathers left of mothers is a layout concern; the graph only guarantees
    // both parents are linked to the focus.
    const edges = graph?.edges ?? [];
    expect(edges).toHaveLength(2);
    for (const edge of edges) {
      expect(edge.target).toBe('person:child@focus');
    }
  });

  it('caps ancestor generations', () => {
    const persons = [person('child'), person('p'), person('gp'), person('ggp')];
    const families = [
      family('F1', ['p'], ['child']),
      family('F2', ['gp'], ['p']),
      family('F3', ['ggp'], ['gp']),
    ];

    const graph = buildAncestorGraph('child', persons, families, { maxGenerations: 2 });
    const ids = graph?.nodes.map((node) => node.personId);
    expect(ids).toContain('gp');
    expect(ids).not.toContain('ggp');
  });

  it('duplicates a person per family role (adoption, pedigree collapse)', () => {
    const persons = [person('child'), person('p1'), person('p2'), person('shared')];
    const families = [
      family('F1', ['p1', 'shared'], ['child']),
      family('F2', ['p2'], ['p1']),
      family('F3', ['shared'], ['p2']),
    ];

    const graph = buildAncestorGraph('child', persons, families, { maxGenerations: 3 });
    const shared = graph?.nodes.filter((node) => node.personId === 'shared');
    // `shared` is the focus's parent (F1) and an ancestor again via F3.
    expect(shared?.map((node) => node.key).sort()).toEqual([
      'person:shared@parent:F1',
      'person:shared@parent:F3',
    ]);
  });

  it('does not recurse forever when the data contains an ancestry cycle', () => {
    const persons = [person('kid'), person('adult')];
    // `adult` is the parent of `kid`, but also listed as its own descendant's
    // parent — a cycle through the same family.
    const families = [family('F1', ['adult'], ['kid']), family('F2', ['kid'], ['adult'])];

    const graph = buildAncestorGraph('kid', persons, families, { maxGenerations: 10 });
    const generations = graph?.nodes.map((node) => node.generation) ?? [];
    expect(Math.max(...generations)).toBeLessThanOrEqual(3);
  });

  it('returns null for an unknown focus person', () => {
    expect(buildAncestorGraph('missing', [person('a')], [])).toBeNull();
  });
});

describe('suggestFocusPerson', () => {
  it('prefers a childless child — the youngest generation', () => {
    const persons = [person('father', 'M'), person('mother', 'F'), person('child')];
    const families = [family('F1', ['father', 'mother'], ['child'])];
    expect(suggestFocusPerson(persons, families)).toBe('child');
  });

  it('falls back to the first child in list order when nobody is a leaf', () => {
    const persons = [person('gp'), person('p')];
    const families = [family('F1', ['gp'], ['p']), family('F2', ['p'], ['gp'])];
    // Both `p` and `gp` are children and parents — no leaf exists.
    expect(suggestFocusPerson(persons, families)).toBe('gp');
  });

  it('falls back to the first person when nobody is a child', () => {
    const persons = [person('a'), person('b')];
    expect(suggestFocusPerson(persons, [])).toBe('a');
  });

  it('returns undefined for an empty tree', () => {
    expect(suggestFocusPerson([], [])).toBeUndefined();
  });
});

describe('layoutAncestors', () => {
  const fixture = () => {
    const persons = [
      person('child'),
      person('father', 'M'),
      person('mother', 'F'),
      person('gpa', 'M'),
      person('gma', 'F'),
      person('uncle', 'M'),
    ];
    const families = [
      family('F1', ['father', 'mother'], ['child']),
      family('F2', ['gpa', 'gma'], ['father', 'uncle']),
    ];
    return { persons, families };
  };

  it('places the focus at the origin and ancestors above', () => {
    const { persons, families } = fixture();
    const layout = layoutAncestors('child', persons, families);
    expect(layout).not.toBeNull();
    const byKey = new Map(layout?.nodes.map((node) => [node.key, node]));
    expect(byKey.get('person:child@focus')?.x).toBe(0);
    expect(byKey.get('person:child@focus')?.y).toBe(0);
    for (const node of layout?.nodes ?? []) {
      if (node.key !== 'person:child@focus') {
        expect(node.y).toBeLessThan(0);
      }
    }
  });

  it('keeps same-generation cards from overlapping', () => {
    const { persons, families } = fixture();
    const layout = layoutAncestors('child', persons, families, {
      nodeWidth: 180,
      nodeHeight: 64,
      columnGap: 24,
    });
    const byGeneration = new Map<number, LaidOutNode[]>();
    for (const node of layout?.nodes ?? []) {
      const list = byGeneration.get(node.generation) ?? [];
      list.push(node);
      byGeneration.set(node.generation, list);
    }
    for (const nodes of byGeneration.values()) {
      const sorted = [...nodes].sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i += 1) {
        const left = sorted[i - 1];
        const right = sorted[i];
        if (!left || !right) {
          continue;
        }
        expect(right.x - left.x).toBeGreaterThanOrEqual(180 + 24);
      }
    }
  });

  it('orders fathers left of mothers within a couple', () => {
    const { persons, families } = fixture();
    const layout = layoutAncestors('child', persons, families);
    const byPerson = new Map(layout?.nodes.map((node) => [node.personId, node]));
    expect((byPerson.get('father')?.x ?? 1)).toBeLessThan(byPerson.get('mother')?.x ?? 0);
  });

  it('reports a bounding box that contains every card', () => {
    const { persons, families } = fixture();
    const layout = layoutAncestors('child', persons, families, { nodeWidth: 180, nodeHeight: 64 });
    const minX = Math.min(...(layout?.nodes.map((node) => node.x - 90) ?? [0]));
    const maxX = Math.max(...(layout?.nodes.map((node) => node.x + 90) ?? [0]));
    const minY = Math.min(...(layout?.nodes.map((node) => node.y - 32) ?? [0]));
    const maxY = Math.max(...(layout?.nodes.map((node) => node.y + 32) ?? [0]));
    expect(layout?.width).toBeCloseTo(maxX - minX);
    expect(layout?.height).toBeCloseTo(maxY - minY);
  });

  it('returns null for an unknown focus person', () => {
    expect(layoutAncestors('missing', [], [])).toBeNull();
  });
});

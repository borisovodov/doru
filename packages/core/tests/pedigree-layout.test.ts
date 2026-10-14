import { describe, expect, it } from 'vitest';
import { layoutPedigree, suggestFocusPerson, type LaidOutCard } from '../src/layout/pedigree';
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

/** Nuclear family: father + mother → child. */
const nuclear = () => ({
  persons: [person('child'), person('father', 'M'), person('mother', 'F')],
  families: [family('F1', ['father', 'mother'], ['child'])],
});

describe('suggestFocusPerson', () => {
  it('prefers a childless child — the youngest generation', () => {
    const { persons, families } = nuclear();
    expect(suggestFocusPerson(persons, families)).toBe('child');
  });

  it('falls back to the first child in list order when nobody is a leaf', () => {
    const persons = [person('gp'), person('p')];
    const families = [family('F1', ['gp'], ['p']), family('F2', ['p'], ['gp'])];
    expect(suggestFocusPerson(persons, families)).toBe('gp');
  });

  it('falls back to the first person when nobody is a child', () => {
    expect(suggestFocusPerson([person('a'), person('b')], [])).toBe('a');
  });

  it('returns undefined for an empty tree', () => {
    expect(suggestFocusPerson([], [])).toBeUndefined();
  });
});

describe('layoutPedigree — ancestors', () => {
  it('renders the focus, a couple above and a marriage edge between them', () => {
    const { persons, families } = nuclear();
    const layout = layoutPedigree('child', persons, families);
    expect(layout).not.toBeNull();
    const byKey = new Map(layout?.cards.map((card) => [card.key, card]));
    expect(byKey.get('person:child@focus')?.x).toBe(0);
    expect(byKey.get('person:child@focus')?.y).toBe(0);
    expect(byKey.get('person:father@spouse:F1')?.generation).toBe(1);
    expect(byKey.get('person:mother@spouse:F1')?.generation).toBe(1);
    const marriages = layout?.edges.filter((edge) => edge.kind === 'marriage') ?? [];
    expect(marriages).toHaveLength(1);
    expect(marriages[0]?.source).toBe('person:father@spouse:F1');
    expect(marriages[0]?.target).toBe('person:mother@spouse:F1');
    const pedigree = layout?.edges.filter((edge) => edge.kind === 'pedigree') ?? [];
    expect(pedigree).toHaveLength(2);
    for (const edge of pedigree) {
      expect(edge.target).toBe('person:child@focus');
    }
  });

  it('puts the father left of the mother and ancestors above the focus', () => {
    const { persons, families } = nuclear();
    const layout = layoutPedigree('child', persons, families);
    const byKey = new Map(layout?.cards.map((card) => [card.key, card]));
    const father = byKey.get('person:father@spouse:F1');
    const mother = byKey.get('person:mother@spouse:F1');
    expect((father?.x ?? 1)).toBeLessThan(mother?.x ?? 0);
    expect(father?.y).toBeLessThan(0);
    expect(mother?.y).toBeLessThan(0);
  });

  it('caps ancestor generations', () => {
    const persons = [person('child'), person('p'), person('gp'), person('ggp')];
    const families = [
      family('F1', ['p'], ['child']),
      family('F2', ['gp'], ['p']),
      family('F3', ['ggp'], ['gp']),
    ];
    const layout = layoutPedigree('child', persons, families, { maxGenerations: 2 });
    const ids = layout?.cards.map((card) => card.personId);
    expect(ids).toContain('gp');
    expect(ids).not.toContain('ggp');
  });

  it('keeps cards from overlapping within each row', () => {
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
    const layout = layoutPedigree('child', persons, families, {
      nodeWidth: 180,
      coupleGap: 16,
      columnGap: 24,
    });
    const byRow = new Map<number, LaidOutCard[]>();
    for (const card of layout?.cards ?? []) {
      const list = byRow.get(card.generation) ?? [];
      list.push(card);
      byRow.set(card.generation, list);
    }
    for (const cards of byRow.values()) {
      const sorted = [...cards].sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i += 1) {
        const left = sorted[i - 1];
        const right = sorted[i];
        if (!left || !right) {
          continue;
        }
        expect(right.x - left.x).toBeGreaterThanOrEqual(180);
      }
    }
  });

  it('duplicates a shared ancestor per couple role (pedigree collapse)', () => {
    const persons = [person('child'), person('p1'), person('p2'), person('shared', 'M')];
    const families = [
      family('F1', ['p1', 'shared'], ['child']),
      family('F2', ['p2'], ['p1']),
      family('F3', ['shared'], ['p2']),
    ];
    const layout = layoutPedigree('child', persons, families, { maxGenerations: 3 });
    const shared = layout?.cards.filter((card) => card.personId === 'shared');
    expect(shared?.map((card) => card.key).sort()).toEqual([
      'person:shared@spouse:F1',
      'person:shared@spouse:F3',
    ]);
  });

  it('does not recurse forever when the data contains an ancestry cycle', () => {
    const persons = [person('kid'), person('adult', 'M')];
    const families = [family('F1', ['adult'], ['kid']), family('F2', ['kid'], ['adult'])];
    const layout = layoutPedigree('kid', persons, families, { maxGenerations: 10 });
    const rows = layout?.cards.map((card) => card.generation) ?? [];
    expect(Math.max(...rows)).toBeLessThanOrEqual(3);
  });

  it('supports a single parent', () => {
    const persons = [person('child'), person('mother', 'F')];
    const families = [family('F1', ['mother'], ['child'])];
    const layout = layoutPedigree('child', persons, families);
    const byKey = new Map(layout?.cards.map((card) => [card.key, card]));
    expect(byKey.get('person:mother@spouse:F1')).toBeDefined();
    const marriages = layout?.edges.filter((edge) => edge.kind === 'marriage') ?? [];
    expect(marriages).toHaveLength(0);
    const pedigree = layout?.edges.filter((edge) => edge.kind === 'pedigree') ?? [];
    expect(pedigree).toHaveLength(1);
  });

  it('returns null for an unknown focus person', () => {
    expect(layoutPedigree('missing', [], [])).toBeNull();
  });
});

describe('layoutPedigree — descendants', () => {
  it('renders spouses beside the focus and children below, ordered by birth', () => {
    const persons = [
      person('focus', 'M'),
      person('wife', 'F'),
      person('son', 'M', 2000),
      person('daughter', 'F', 1998),
    ];
    const families = [family('F1', ['focus', 'wife'], ['son', 'daughter'])];
    const layout = layoutPedigree('focus', persons, families, { direction: 'descendants' });
    const byKey = new Map(layout?.cards.map((card) => [card.key, card]));
    const focus = byKey.get('person:focus@focus');
    const wife = byKey.get('person:wife@spouse:F1');
    const son = byKey.get('person:son@child:F1');
    const daughter = byKey.get('person:daughter@child:F1');
    expect(focus?.y).toBe(0);
    expect(wife?.y).toBe(0);
    expect(son?.generation).toBe(1);
    expect((son?.y ?? 0)).toBeGreaterThan(0);
    // Daughter born earlier → left of son.
    expect((daughter?.x ?? 1)).toBeLessThan(son?.x ?? 0);
    const marriages = layout?.edges.filter((edge) => edge.kind === 'marriage') ?? [];
    expect(marriages).toHaveLength(1);
    expect(marriages[0]?.source).toBe('person:focus@focus');
    expect(marriages[0]?.target).toBe('person:wife@spouse:F1');
    // Both parents connect to both children.
    const pedigree = layout?.edges.filter((edge) => edge.kind === 'pedigree') ?? [];
    expect(pedigree).toHaveLength(4);
  });

  it('lays out second marriages side by side without overlapping spouses', () => {
    const persons = [
      person('focus', 'M'),
      person('wife1', 'F'),
      person('wife2', 'F'),
      person('kid1'),
      person('kid2'),
    ];
    const families = [
      family('F1', ['focus', 'wife1'], ['kid1']),
      family('F2', ['focus', 'wife2'], ['kid2']),
    ];
    const layout = layoutPedigree('focus', persons, families, {
      direction: 'descendants',
      nodeWidth: 180,
      coupleGap: 16,
    });
    const wife1 = layout?.cards.find((card) => card.personId === 'wife1');
    const wife2 = layout?.cards.find((card) => card.personId === 'wife2');
    expect(wife1).toBeDefined();
    expect(wife2).toBeDefined();
    expect(Math.abs((wife2?.x ?? 0) - (wife1?.x ?? 0))).toBeGreaterThanOrEqual(180);
    // Two marriage edges, one per spouse.
    const marriages = layout?.edges.filter((edge) => edge.kind === 'marriage') ?? [];
    expect(marriages).toHaveLength(2);
  });

  it('duplicates a child who belongs to two families of the focus', () => {
    const persons = [
      person('focus', 'M'),
      person('wife1', 'F'),
      person('wife2', 'F'),
      person('kid'),
    ];
    const families = [
      family('F1', ['focus', 'wife1'], ['kid']),
      family('F2', ['focus', 'wife2'], ['kid']),
    ];
    const layout = layoutPedigree('focus', persons, families, { direction: 'descendants' });
    const kid = layout?.cards.filter((card) => card.personId === 'kid');
    expect(kid?.map((card) => card.key).sort()).toEqual([
      'person:kid@child:F1',
      'person:kid@child:F2',
    ]);
  });

  it('stops at the generation cap', () => {
    const persons = [person('focus', 'M'), person('kid'), person('gkid')];
    const families = [
      family('F1', ['focus'], ['kid']),
      family('F2', ['kid'], ['gkid']),
    ];
    const layout = layoutPedigree('focus', persons, families, {
      direction: 'descendants',
      maxGenerations: 1,
    });
    const ids = layout?.cards.map((card) => card.personId);
    expect(ids).toContain('kid');
    expect(ids).not.toContain('gkid');
  });
});

describe('layoutPedigree — geometry', () => {
  it('emits bracket geometry between parent and child rows', () => {
    const { persons, families } = nuclear();
    const layout = layoutPedigree('child', persons, families, {
      nodeHeight: 64,
      rowGap: 48,
    });
    const pedigree = layout?.edges.filter((edge) => edge.kind === 'pedigree') ?? [];
    for (const edge of pedigree) {
      // from = parent bottom edge; to = child top edge; the rows are
      // separated by one rowGap.
      expect(edge.geometry.from.y - edge.geometry.to.y).toBeCloseTo(-48);
      expect(Math.abs(edge.geometry.from.x - edge.geometry.to.x)).toBeGreaterThan(0);
    }
    const marriage = layout?.edges.find((edge) => edge.kind === 'marriage');
    expect(marriage).toBeDefined();
    // Marriage line sits between the inner edges of the couple's cards.
    expect((marriage?.geometry.to.x ?? 0) - (marriage?.geometry.from.x ?? 0)).toBeCloseTo(16);
    expect(marriage?.geometry.from.y).toBe(marriage?.geometry.to.y);
  });
});

import { describe, expect, it } from 'vitest';
import type { FamilyRecord, PersonRecord } from '../src/model/types';
import { DEFAULT_OPTIONS } from '../src/layout/types';
import { layoutFamilyView } from '../src/layout/family';

const person = (id: string, sex: PersonRecord['sex'] = 'U'): PersonRecord => ({
  id,
  names: [],
  sex,
  facts: [],
});

const family = (id: string, partners: string[], children: string[]): FamilyRecord => ({
  id,
  partners,
  children,
});

const merged = { ...DEFAULT_OPTIONS, collapsed: new Set<string>() };

describe('layoutFamilyView', () => {
  it('returns null when the focus person is not in the tree', () => {
    expect(layoutFamilyView('missing', [person('a')], [], merged)).toBeNull();
  });

  it('places a male spouse left of a female focus', () => {
    const layout = layoutFamilyView(
      'focus',
      [person('focus', 'F'), person('spouse', 'M')],
      [family('F1', ['focus', 'spouse'], [])],
      merged,
    );
    expect(layout).not.toBeNull();
    const focus = layout!.cards.find((card) => card.role === 'focus')!;
    const spouse = layout!.cards.find((card) => card.role === 'spouse')!;
    expect(focus.x).toBeGreaterThan(spouse.x);
    expect(layout!.edges.some((edge) => edge.kind === 'marriage')).toBe(true);
  });

  it('places a female spouse right of a male focus', () => {
    const layout = layoutFamilyView(
      'focus',
      [person('focus', 'M'), person('spouse', 'F')],
      [family('F1', ['focus', 'spouse'], [])],
      merged,
    );
    const focus = layout!.cards.find((card) => card.role === 'focus')!;
    const spouse = layout!.cards.find((card) => card.role === 'spouse')!;
    expect(focus.x).toBeLessThan(spouse.x);
  });

  it('lays out several spouses on alternating flanks', () => {
    const layout = layoutFamilyView(
      'focus',
      [person('focus'), person('s1'), person('s2')],
      [family('F1', ['focus', 's1'], []), family('F2', ['focus', 's2'], [])],
      merged,
    );
    const spouses = layout!.cards.filter((card) => card.role === 'spouse');
    expect(spouses).toHaveLength(2);
    expect(spouses[0]!.x).not.toBe(spouses[1]!.x);
    expect(layout!.edges.filter((edge) => edge.kind === 'marriage')).toHaveLength(2);
  });

  it('draws parent couples of the focus and of each spouse', () => {
    const layout = layoutFamilyView(
      'focus',
      [person('focus'), person('spouse'), person('father'), person('mother'), person('inlaw')],
      [
        family('F1', ['focus', 'spouse'], []),
        family('F2', ['father', 'mother'], ['focus']),
        family('F3', ['inlaw'], ['spouse']),
      ],
      merged,
    );
    const parents = layout!.cards.filter((card) => card.generation === -1);
    expect(parents.map((card) => card.personId).sort()).toEqual(['father', 'inlaw', 'mother']);
    expect(layout!.edges.filter((edge) => edge.kind === 'pedigree').length).toBeGreaterThan(0);
  });

  it('skips the marriage family when scanning a spouse’s parent families', () => {
    const layout = layoutFamilyView(
      'focus',
      [person('focus'), person('spouse')],
      [family('F1', ['focus', 'spouse'], ['spouse'])],
      merged,
    );
    expect(layout).not.toBeNull();
    // The spouse is a child of F1 and its partner — no separate parent
    // block for the same family, so only the focus row and the child row
    // exist.
    const generations = new Set(layout!.cards.map((card) => card.generation));
    expect(generations.has(-1)).toBe(false);
  });

  it('lays out children centered under the focus', () => {
    const layout = layoutFamilyView(
      'focus',
      [person('focus'), person('spouse'), person('k1'), person('k2')],
      [family('F1', ['focus', 'spouse'], ['k1', 'k2'])],
      merged,
    );
    const children = layout!.cards.filter((card) => card.role === 'child');
    expect(children).toHaveLength(2);
    expect(children.every((card) => card.generation === 1)).toBe(true);
    expect(layout!.edges.filter((edge) => edge.kind === 'pedigree').length).toBeGreaterThanOrEqual(3);
  });
});

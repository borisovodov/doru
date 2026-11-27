import { describe, expect, it } from 'vitest';
import type { LaidOutCard, PedigreeEdge, PedigreeLayout, PersonRecord } from '@doru/core';
import type { PersonCounts } from '../src/tree/types';
import { buildTreeView } from '../src/tree/view';

const person = (id: string): PersonRecord => ({ id, names: [], sex: 'U', facts: [] });

function card(overrides: Partial<LaidOutCard> = {}): LaidOutCard {
  return {
    key: 'focus',
    personId: 'P1',
    role: 'focus',
    familyId: null,
    generation: 0,
    line: null,
    x: 0,
    y: 0,
    ...overrides,
  };
}

function layout(overrides: Partial<PedigreeLayout> = {}): PedigreeLayout {
  return {
    cards: [],
    edges: [],
    focusKey: 'focus',
    width: 360,
    height: 176,
    minX: -180,
    minY: -112,
    ...overrides,
  };
}

describe('buildTreeView', () => {
  it('emits generation bands per row, sorted by card position', () => {
    const view = buildTreeView(
      layout({
        cards: [
          card({ key: 'focus', generation: 0, x: 0, y: 0 }),
          card({ key: 'anc', personId: 'P2', generation: 1, x: 0, y: -112 }),
        ],
      }),
      [person('P1'), person('P2')],
      {},
      new Map(),
    );

    expect(view.bands).toEqual([
      { generation: 1, y: -112 },
      { generation: 0, y: 0 },
    ]);
  });

  it('maps cards to persons, focus, counts and photos', () => {
    const view = buildTreeView(
      layout({
        focusKey: 'focus',
        cards: [
          card({
            key: 'focus',
            personId: 'P1',
            x: 100,
            y: 200,
          }),
        ],
      }),
      [person('P1')],
      { P1: { notes: 2, sources: 1, media: 0 } },
      new Map([['P1', 'doru-media://local/?path=photo.jpg']]),
    );

    expect(view.cards).toHaveLength(1);
    expect(view.cards[0]).toMatchObject({
      card: { key: 'focus', x: 100, y: 200 },
      person: person('P1'),
      isFocus: true,
      counts: { notes: 2, sources: 1, media: 0 },
      photo: 'doru-media://local/?path=photo.jpg',
    });
  });

  it('substitutes a fallback person and default counts for unknown ids', () => {
    const view = buildTreeView(layout({ cards: [card({ key: 'ghost', personId: 'MISSING' })] }), [], {}, new Map());

    expect(view.cards[0]).toMatchObject({
      person: { id: 'MISSING', names: [], sex: 'U', facts: [] },
      isFocus: false,
      counts: { notes: 0, sources: 0, media: 0 } satisfies PersonCounts,
    });
    expect(view.cards[0]?.photo).toBeUndefined();
  });

  it('passes the precomputed edges through unchanged', () => {
    const edge: PedigreeEdge = {
      id: 'e1',
      kind: 'marriage',
      source: 'a',
      target: 'b',
      familyId: 'F1',
      geometry: { from: { x: 0, y: 0 }, to: { x: 100, y: 0 } },
    };
    const view = buildTreeView(layout({ edges: [edge] }), [], {}, new Map());
    expect(view.edges).toEqual([edge]);
  });
});

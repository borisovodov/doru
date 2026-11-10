import { describe, expect, it, vi } from 'vitest';
import type { PedigreeLayout, PersonRecord } from '@doru/core';
import type { PedigreeEdgeKind } from '@doru/core';
import { projectLayout } from '../src/tree/project';
import type { ProjectionCallbacks } from '../src/tree/project';
import type { PersonCounts } from '../src/tree/types';
import { CARD_HEIGHT, CARD_WIDTH, ROW_HEIGHT } from '../src/tree/sizes';

const person = (id: string): PersonRecord => ({ id, names: [], sex: 'U', facts: [] });

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

const callbacks: ProjectionCallbacks = {
  onToggleCollapse: vi.fn(),
  onAction: vi.fn(),
};

describe('projectLayout', () => {
  it('emits a generation band per row, sorted and styled', () => {
    const { nodes, edges } = projectLayout(
      layout({
        cards: [
          { key: 'focus', personId: 'P1', role: 'focus', familyId: null, generation: 1, line: null, hasSubtree: false, x: 0, y: 0 },
          { key: 'anc', personId: 'P2', role: 'focus', familyId: null, generation: 0, line: 'paternal', hasSubtree: true, x: 0, y: -112 },
        ],
      }),
      [person('P1'), person('P2')],
      new Set(),
      {},
      null,
      callbacks,
    );

    expect(edges).toEqual([]);
    const bands = nodes.filter((node) => node.type === 'generationBand');
    expect(bands.map((band) => band.id)).toEqual(['band:0', 'band:1']);
    const band = bands[0]!;
    expect(band.position).toEqual({ x: layout().minX - 240, y: -ROW_HEIGHT / 2 });
    expect(band.measured).toEqual({ width: layout().width + 480, height: ROW_HEIGHT });
    expect(band.data).toEqual({ generation: 0 });
    expect(band.selectable).toBe(false);
    expect(band.draggable).toBe(false);
  });

  it('positions cards from the layout geometry with measured bounds and handles', () => {
    const { nodes } = projectLayout(
      layout({
        focusKey: 'focus',
        cards: [
          { key: 'focus', personId: 'P1', role: 'focus', familyId: null, generation: 0, line: null, hasSubtree: true, x: 100, y: 200 },
        ],
      }),
      [person('P1')],
      new Set(['P1']),
      { P1: { notes: 2, sources: 1, media: 0 } },
      null,
      callbacks,
    );

    const card = nodes.find((node) => node.type === 'personCard')!;
    expect(card.id).toBe('focus');
    expect(card.position).toEqual({ x: 100 - CARD_WIDTH / 2, y: 200 - CARD_HEIGHT / 2 });
    expect(card.measured).toEqual({ width: CARD_WIDTH, height: CARD_HEIGHT });
    expect(card.handles).toEqual([
      { type: 'source', position: 'bottom', id: 'bottom', x: CARD_WIDTH / 2, y: CARD_HEIGHT },
      { type: 'target', position: 'top', id: 'top', x: CARD_WIDTH / 2, y: 0 },
    ]);
    expect(card.data).toMatchObject({
      person: person('P1'),
      line: null,
      isFocus: true,
      hasSubtree: true,
      collapsed: true,
      counts: { notes: 2, sources: 1, media: 0 },
      isDropTarget: false,
    });
  });

  it('substitutes a fallback person and default counts for unknown ids', () => {
    const { nodes } = projectLayout(
      layout({
        cards: [
          { key: 'ghost', personId: 'MISSING', role: 'focus', familyId: null, generation: 0, line: null, hasSubtree: false, x: 0, y: 0 },
        ],
      }),
      [],
      new Set(),
      {},
      'MISSING',
      callbacks,
    );

    const card = nodes.find((node) => node.type === 'personCard')!;
    expect(card.data).toMatchObject({
      person: { id: 'MISSING', names: [], sex: 'U', facts: [] },
      isFocus: false,
      counts: { notes: 0, sources: 0, media: 0 } satisfies PersonCounts,
      isDropTarget: true,
    });
  });

  it('projects edges with their geometry as the edge data', () => {
    const kind: PedigreeEdgeKind = 'marriage';
    const { nodes, edges } = projectLayout(
      layout({
        cards: [
          { key: 'a', personId: 'P1', role: 'focus', familyId: null, generation: 0, line: null, hasSubtree: false, x: 0, y: 0 },
          { key: 'b', personId: 'P2', role: 'spouse', familyId: 'F1', generation: 0, line: null, hasSubtree: false, x: 100, y: 0 },
        ],
        edges: [
          {
            id: 'e1',
            kind,
            source: 'a',
            target: 'b',
            familyId: 'F1',
            geometry: { from: { x: 0, y: 0 }, to: { x: 100, y: 0 } },
          },
        ],
      }),
      [person('P1'), person('P2')],
      new Set(),
      {},
      null,
      callbacks,
    );

    expect(nodes).toHaveLength(3); // one band + two cards
    expect(edges).toEqual([
      {
        id: 'e1',
        type: 'marriage',
        source: 'a',
        target: 'b',
        data: { from: { x: 0, y: 0 }, to: { x: 100, y: 0 } },
      },
    ]);
  });
});

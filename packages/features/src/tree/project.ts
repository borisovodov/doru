import type { PedigreeLayout, PersonRecord } from '@doru/core';
import type { Edge, Node } from '@xyflow/react';
import type { CanvasEdgeData } from './PedigreeEdges';
import type { PersonCardData } from './PersonCard';
import type { GenerationBandData } from './GenerationBand';
import type { CardAction } from './PersonCard';
import type { PersonCounts } from './types';
import { CARD_HEIGHT, CARD_WIDTH, ROW_HEIGHT } from './sizes';

export type CanvasNode = Node<PersonCardData | GenerationBandData, string>;

export interface ProjectionCallbacks {
  onToggleCollapse(personId: string): void;
  onAction(action: CardAction, personId: string): void;
}

/**
 * Turns a pure pedigree layout into React Flow nodes and edges. Generation
 * bands sit first so they stay below the cards in the DOM order.
 */
export function projectLayout(
  layout: PedigreeLayout,
  persons: PersonRecord[],
  collapsed: ReadonlySet<string>,
  counts: Record<string, PersonCounts>,
  callbacks: ProjectionCallbacks,
): { nodes: CanvasNode[]; edges: Edge[] } {
  const personById = new Map(persons.map((person) => [person.id, person]));
  const fallbackPerson = (id: string): PersonRecord => ({ id, names: [], sex: 'U' });

  const bandNodes: Node<GenerationBandData, 'generationBand'>[] = [
    ...new Set(layout.cards.map((card) => card.generation)),
  ]
    .sort((a, b) => a - b)
    .map((generation) => ({
      id: `band:${generation}`,
      type: 'generationBand',
      position: {
        x: layout.minX - 240,
        y: generation * ROW_HEIGHT - ROW_HEIGHT / 2,
      },
      style: { width: layout.width + 480, height: ROW_HEIGHT },
      data: { generation },
      selectable: false,
      draggable: false,
    }));

  const cardNodes: Node<PersonCardData, 'personCard'>[] = layout.cards.map((card) => ({
    id: card.key,
    type: 'personCard',
    position: { x: card.x - CARD_WIDTH / 2, y: card.y - CARD_HEIGHT / 2 },
    data: {
      person: personById.get(card.personId) ?? fallbackPerson(card.personId),
      line: card.line,
      isFocus: card.key === layout.focusKey,
      hasSubtree: card.hasSubtree,
      collapsed: collapsed.has(card.personId),
      counts: counts[card.personId] ?? { notes: 0, sources: 0, media: 0 },
      onToggleCollapse: callbacks.onToggleCollapse,
      onAction: callbacks.onAction,
    } satisfies PersonCardData,
  }));

  const flowEdges: Edge[] = layout.edges.map((edge) => ({
    id: edge.id,
    type: edge.kind,
    source: edge.source,
    target: edge.target,
    data: edge.geometry as CanvasEdgeData,
  }));

  return { nodes: [...bandNodes, ...cardNodes], edges: flowEdges };
}

import { useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import { layoutAncestors, suggestFocusPerson } from '@doru/core/layout';
import type { FamilyRecord, PersonRecord } from '@doru/core';
import { nls } from '../nls';
import { PersonCard, type PersonCardData } from './PersonCard';
import '@xyflow/react/dist/style.css';
import './TreeCanvas.css';

export interface TreeCanvasProps {
  persons: PersonRecord[];
  families: FamilyRecord[];
}

/** Must match the card size in TreeCanvas.css — the layout depends on it. */
const CARD_WIDTH = 180;
const CARD_HEIGHT = 64;

const nodeTypes = { personCard: PersonCard };

/**
 * The tree tab: one full-size canvas. The graph is derived from the domain
 * model on every render (controlled mode) — React Flow never owns the data.
 * M0: ancestor fan of a suggested focus person, four generations, no
 * editing yet.
 */
export function TreeCanvas({ persons, families }: TreeCanvasProps) {
  const focusId = suggestFocusPerson(persons, families);

  const layout = useMemo(() => {
    if (!focusId) {
      return null;
    }
    return layoutAncestors(focusId, persons, families, {
      maxGenerations: 4,
      nodeWidth: CARD_WIDTH,
      nodeHeight: CARD_HEIGHT,
    });
  }, [focusId, persons, families]);

  const { nodes, edges } = useMemo(() => {
    if (!layout) {
      return { nodes: [] as Node<PersonCardData, 'personCard'>[], edges: [] as Edge[] };
    }
    const personById = new Map(persons.map((person) => [person.id, person]));
    const flowNodes: Node<PersonCardData, 'personCard'>[] = layout.nodes.map((node) => ({
      id: node.key,
      type: 'personCard',
      position: { x: node.x - CARD_WIDTH / 2, y: node.y - CARD_HEIGHT / 2 },
      data: { person: personById.get(node.personId) ?? { id: node.personId, names: [], sex: 'U' } },
    }));
    const flowEdges: Edge[] = layout.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    }));
    return { nodes: flowNodes, edges: flowEdges };
  }, [layout, persons]);

  if (persons.length === 0) {
    return (
      <div className="tree-view">
        <div className="tree-canvas">
          <p className="tree-canvas-empty">{nls.t('features.tree.emptyTree')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tree-view">
      <div className="tree-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

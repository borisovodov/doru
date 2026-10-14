import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { layoutPedigree, suggestFocusPerson } from '@doru/core/layout';
import type { ChartDirection, FamilyRecord, PersonRecord } from '@doru/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { nls } from '../nls';
import { displayName } from '../person/format';
import { MarriageEdge, PedigreeEdge, type CanvasEdgeData } from './PedigreeEdges';
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
const edgeTypes = { pedigree: PedigreeEdge, marriage: MarriageEdge };

interface FocusHistory {
  stack: string[];
  index: number;
}

/**
 * The tree tab: one full-size canvas. The graph is derived from the domain
 * model on every render (controlled mode) — React Flow never owns the data.
 * Double-clicking a card refocuses the chart; the toolbar switches between
 * ancestors and descendants and walks the focus history.
 */
export function TreeCanvas(props: TreeCanvasProps) {
  return (
    <ReactFlowProvider>
      <TreeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function TreeCanvasInner({ persons, families }: TreeCanvasProps) {
  const [direction, setDirection] = useState<ChartDirection>('ancestors');
  const [history, setHistory] = useState<FocusHistory | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const { setViewport } = useReactFlow();

  const suggested = suggestFocusPerson(persons, families);
  const focusId = history ? history.stack[history.index] : suggested;
  // Fall back to the suggested focus when the history points at a person
  // that no longer exists (deleted by an edit or an agent).
  const effectiveFocus =
    focusId !== undefined && persons.some((person) => person.id === focusId)
      ? focusId
      : suggested;

  const layout = useMemo(() => {
    if (!effectiveFocus) {
      return null;
    }
    return layoutPedigree(effectiveFocus, persons, families, {
      direction,
      maxGenerations: 4,
      nodeWidth: CARD_WIDTH,
      nodeHeight: CARD_HEIGHT,
    });
  }, [effectiveFocus, persons, families, direction]);

  const projected = useMemo(() => {
    if (!layout) {
      return { nodes: [] as Node<PersonCardData, 'personCard'>[], edges: [] as Edge[] };
    }
    const personById = new Map(persons.map((person) => [person.id, person]));
    const flowNodes: Node<PersonCardData, 'personCard'>[] = layout.cards.map((card) => ({
      id: card.key,
      type: 'personCard',
      position: { x: card.x - CARD_WIDTH / 2, y: card.y - CARD_HEIGHT / 2 },
      data: {
        person: personById.get(card.personId) ?? { id: card.personId, names: [], sex: 'U' },
      },
    }));
    const flowEdges: Edge[] = layout.edges.map((edge) => ({
      id: edge.id,
      type: edge.kind,
      source: edge.source,
      target: edge.target,
      data: edge.geometry as CanvasEdgeData,
    }));
    return { nodes: flowNodes, edges: flowEdges };
  }, [layout, persons]);

  // React Flow is controlled through these two states: every projection
  // resets them, and UI-only changes (selection) are applied through the
  // standard change handlers.
  const [nodes, setNodes] = useState<Node<PersonCardData, 'personCard'>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  useEffect(() => {
    setNodes(projected.nodes);
    setEdges(projected.edges);
  }, [projected]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current) as Node<PersonCardData, 'personCard'>[]);
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((current) => applyEdgeChanges(changes, current) as Edge[]);
  }, []);

  // Fit the chart into the canvas. Deterministic: computed from the exact
  // layout bounds, no node measurement involved. Never zooms in beyond 1 —
  // a small tree stays at natural card size instead of ballooning. The
  // layout-change call runs as a macrotask so that it lands after React
  // StrictMode's double-mount of the React Flow subtree (whose second
  // pan/zoom instance would otherwise reset the viewport right after us).
  const fitChart = useCallback(() => {
    const el = canvasRef.current;
    if (!el || !layout || el.clientWidth === 0 || el.clientHeight === 0) {
      return;
    }
    const padding = 0.12;
    const fit = Math.min(el.clientWidth / layout.width, el.clientHeight / layout.height);
    const zoom = Math.max(0.1, Math.min(fit * (1 - padding), 1));
    const x = (el.clientWidth - layout.width * zoom) / 2 - layout.minX * zoom;
    const y = (el.clientHeight - layout.height * zoom) / 2 - layout.minY * zoom;
    void setViewport({ x, y, zoom });
  }, [layout, setViewport]);

  useEffect(() => {
    if (!layout) {
      return;
    }
    const timer = setTimeout(fitChart, 0);
    return () => clearTimeout(timer);
  }, [layout, fitChart]);

  // Re-fit when the canvas itself is resized (window resize, sidebars).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(() => fitChart());
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitChart]);

  const refocus = useCallback(
    (personId: string) => {
      if (!persons.some((person) => person.id === personId)) {
        return;
      }
      setHistory((current) => {
        const stack = current ? current.stack.slice(0, current.index + 1) : [];
        if (stack[stack.length - 1] === personId) {
          return current;
        }
        stack.push(personId);
        return { stack, index: stack.length - 1 };
      });
    },
    [persons],
  );

  const goBack = useCallback(() => {
    setHistory((current) =>
      current && current.index > 0 ? { ...current, index: current.index - 1 } : current,
    );
  }, []);

  const goForward = useCallback(() => {
    setHistory((current) =>
      current && current.index < current.stack.length - 1
        ? { ...current, index: current.index + 1 }
        : current,
    );
  }, []);

  const jumpTo = useCallback((index: number) => {
    setHistory((current) => (current ? { ...current, index } : current));
  }, []);

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node<PersonCardData>) => {
      refocus(node.data.person.id);
    },
    [refocus],
  );

  if (persons.length === 0) {
    return (
      <div className="tree-view">
        <div className="tree-canvas">
          <p className="tree-canvas-empty">{nls.t('features.tree.emptyTree')}</p>
        </div>
      </div>
    );
  }

  const focusPerson =
    effectiveFocus !== undefined
      ? persons.find((person) => person.id === effectiveFocus)
      : undefined;
  const breadcrumbs = history ? history.stack.slice(0, history.index + 1) : [];

  return (
    <div className="tree-view">
      <div className="tree-canvas" ref={canvasRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          minZoom={0.1}
          maxZoom={2}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDoubleClick={handleNodeDoubleClick}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
          <Panel position="top-left" className="tree-toolbar">
            <div className="tree-direction" role="group">
              <button
                type="button"
                className={direction === 'ancestors' ? 'active' : undefined}
                onClick={() => setDirection('ancestors')}
              >
                {nls.t('tree.canvas.view.ancestors')}
              </button>
              <button
                type="button"
                className={direction === 'descendants' ? 'active' : undefined}
                onClick={() => setDirection('descendants')}
              >
                {nls.t('tree.canvas.view.descendants')}
              </button>
            </div>
            <div className="tree-nav">
              <button
                type="button"
                title={nls.t('tree.canvas.back')}
                aria-label={nls.t('tree.canvas.back')}
                disabled={!history || history.index === 0}
                onClick={goBack}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                title={nls.t('tree.canvas.forward')}
                aria-label={nls.t('tree.canvas.forward')}
                disabled={!history || history.index >= history.stack.length - 1}
                onClick={goForward}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
            {breadcrumbs.length > 0 && (
              <ol className="tree-breadcrumbs">
                {breadcrumbs.map((personId, index) => (
                  <li key={personId}>
                    <button
                      type="button"
                      className={index === breadcrumbs.length - 1 ? 'current' : undefined}
                      onClick={() => jumpTo(index)}
                    >
                      {displayName(persons.find((person) => person.id === personId))}
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {breadcrumbs.length === 0 && focusPerson && (
              <span className="tree-breadcrumbs-current">
                {displayName(focusPerson)}
              </span>
            )}
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

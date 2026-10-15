import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { layoutPedigree, suggestFocusPerson, isDescendantOf } from '@doru/core/layout';
import type { ChartKind, PersonRecord } from '@doru/core';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { nls } from '../nls';
import { displayName } from '../person/format';
import { GenerationBand } from './GenerationBand';
import { MarriageEdge, PedigreeEdge, SeeAlsoEdge } from './PedigreeEdges';
import { PersonCard, type CardAction, type PersonCardData } from './PersonCard';
import { PersonForm } from './PersonForm';
import { TreeToolbar } from './TreeToolbar';
import { computeFit } from './fit';
import { projectLayout, type CanvasNode } from './project';
import { CARD_HEIGHT, CARD_WIDTH } from './sizes';
import type { FocusHistory, PersonCounts, RelativeRelation, TreeCanvasProps } from './types';
import '@xyflow/react/dist/style.css';
import './TreeCanvas.css';

export type {
  PersonCounts,
  RelativeRelation,
  TreeCanvasApi,
  TreeCanvasProps,
} from './types';

const nodeTypes = { personCard: PersonCard, generationBand: GenerationBand };
const edgeTypes = { pedigree: PedigreeEdge, marriage: MarriageEdge, seeAlso: SeeAlsoEdge };

/**
 * The tree tab: one full-size canvas. The graph is derived from the domain
 * model on every render (controlled mode) — React Flow never owns the data.
 * Double-clicking a card refocuses the chart; the toolbar switches between
 * chart kinds, walks the focus history and collapses branches.
 */
export function TreeCanvas(props: TreeCanvasProps) {
  return (
    <ReactFlowProvider>
      <TreeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function TreeCanvasInner({ persons, families, api, focusRequest }: TreeCanvasProps) {
  const [kind, setKind] = useState<ChartKind>('ancestors');
  const [history, setHistory] = useState<FocusHistory | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set<string>());
  const [form, setForm] = useState<{
    relation: RelativeRelation | 'rename';
    anchorId: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [counts, setCounts] = useState<Record<string, PersonCounts>>({});
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const { setViewport, zoomIn, zoomOut, getIntersectingNodes } = useReactFlow();

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
      kind,
      maxGenerations: 4,
      collapsed,
      nodeWidth: CARD_WIDTH,
      nodeHeight: CARD_HEIGHT,
    });
  }, [effectiveFocus, persons, families, kind, collapsed]);

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

  const handleAction = useCallback(
    (action: CardAction, personId: string) => {
      const person = persons.find((entry) => entry.id === personId);
      if (!person) {
        return;
      }
      if (action === 'edit') {
        api.openEditor(personId);
      } else if (action === 'delete') {
        void api.deletePerson(person);
      } else {
        setForm({ relation: action, anchorId: personId });
      }
    },
    [persons, api],
  );

  const toggleCollapse = useCallback((personId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  }, []);

  const projected = useMemo(() => {
    if (!layout) {
      return { nodes: [] as CanvasNode[], edges: [] as Edge[] };
    }
    return projectLayout(layout, persons, collapsed, counts, null, {
      onToggleCollapse: toggleCollapse,
      onAction: handleAction,
    });
  }, [layout, persons, collapsed, counts, toggleCollapse, handleAction]);

  // React Flow is controlled through these two states: every projection
  // resets them, and UI-only changes (selection) are applied through the
  // standard change handlers.
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  useEffect(() => {
    setNodes(projected.nodes);
    setEdges(projected.edges);
  }, [projected]);

  // Badge counts for the visible cards.
  useEffect(() => {
    if (!layout) {
      setCounts({});
      return;
    }
    let cancelled = false;
    const ids = [...new Set(layout.cards.map((card) => card.personId))];
    void api.getPersonCounts(ids).then((result) => {
      if (!cancelled) {
        setCounts(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [layout, api]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current) as CanvasNode[]);
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((current) => applyEdgeChanges(changes, current) as Edge[]);
  }, []);

  // Fit the chart into the canvas. Deterministic: computed from the exact
  // layout bounds, no node measurement involved. Runs as a macrotask so it
  // lands after React StrictMode's double-mount of the React Flow subtree
  // (whose second pan/zoom instance would otherwise reset the viewport).
  const fitChart = useCallback(() => {
    const el = canvasRef.current;
    if (!el || !layout || el.clientWidth === 0 || el.clientHeight === 0) {
      return;
    }
    void setViewport(computeFit(layout, el.clientWidth, el.clientHeight));
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

  // External focus requests (e.g. a click in the People sidebar).
  const lastFocusRequest = useRef(0);
  useEffect(() => {
    if (focusRequest && focusRequest.nonce !== lastFocusRequest.current) {
      lastFocusRequest.current = focusRequest.nonce;
      refocus(focusRequest.personId);
    }
  }, [focusRequest, refocus]);

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

  const collapseAll = useCallback(() => {
    setCollapsed(new Set(persons.map((person) => person.id)));
  }, [persons]);

  const expandAll = useCallback(() => {
    setCollapsed(new Set());
  }, []);

  const handleFormSubmit = useCallback(
    (person: PersonRecord) => {
      if (!form) {
        return;
      }
      if (form.relation === 'rename') {
        const before = persons.find((entry) => entry.id === form.anchorId);
        if (before) {
          void api.updatePerson(before, person);
        }
      } else {
        void api.addRelative(form.relation, form.anchorId, person);
      }
      setForm(null);
    },
    [form, persons, api],
  );

  const formTitle = useMemo(() => {
    if (!form) {
      return '';
    }
    const name = displayName(persons.find((person) => person.id === form.anchorId));
    switch (form.relation) {
      case 'child':
        return nls.t('tree.canvas.form.childTitle', name);
      case 'spouse':
        return nls.t('tree.canvas.form.spouseTitle', name);
      case 'parent':
        return nls.t('tree.canvas.form.parentTitle', name);
      case 'rename':
        return nls.t('tree.canvas.form.renameTitle', name);
    }
  }, [form, persons]);

  // Drag-to-reparent: dropping a card onto another person's card moves the
  // dragged person (as a child) into that family. Anything else snaps back.
  // The valid drop target is highlighted while dragging by patching the
  // node data in place — the projection must not rerun mid-drag, or the
  // dragged card would snap back to its layout position.
  const resolveDropTarget = useCallback(
    (node: CanvasNode): CanvasNode | undefined => {
      const data = node.data as PersonCardData;
      if (!data.person) {
        return undefined;
      }
      const target = getIntersectingNodes(node).find(
        (candidate) => candidate.type === 'personCard' && candidate.id !== node.id,
      );
      const targetPerson = (target?.data as PersonCardData | undefined)?.person;
      if (
        !target ||
        !targetPerson ||
        targetPerson.id === data.person.id ||
        isDescendantOf(families, data.person.id, targetPerson.id)
      ) {
        return undefined;
      }
      return target as CanvasNode;
    },
    [getIntersectingNodes, families],
  );

  const handleNodeDrag = useCallback(
    (_event: MouseEvent | TouchEvent, node: CanvasNode) => {
      const targetId = resolveDropTarget(node)?.id ?? null;
      setNodes((current) =>
        current.map((entry) => {
          if (entry.type !== 'personCard') {
            return entry;
          }
          const data = entry.data as PersonCardData;
          const isDropTarget = entry.id === targetId;
          if (data.isDropTarget === isDropTarget) {
            return entry;
          }
          return { ...entry, data: { ...data, isDropTarget } };
        }),
      );
    },
    [resolveDropTarget],
  );

  const handleNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: CanvasNode) => {
      const target = resolveDropTarget(node);
      const data = node.data as PersonCardData;
      if (data.person && target) {
        const targetPerson = (target.data as PersonCardData).person;
        void api.reparent(data.person.id, targetPerson.id);
      }
      // Re-project: clears the highlight and snaps the card back.
      setNodes(projected.nodes);
    },
    [resolveDropTarget, api, projected],
  );

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: CanvasNode) => {
      const data = node.data as PersonCardData;
      if (data.person) {
        refocus(data.person.id);
      }
    },
    [refocus],
  );

  if (persons.length === 0) {
    return (
      <div className="tree-view">
        <div className="tree-canvas">
          <p className="tree-canvas-empty">{nls.t('features.tree.emptyTree')}</p>
          <button
            type="button"
            className="tree-canvas-first"
            onClick={() => api.openNewPerson()}
          >
            {nls.t('tree.canvas.addFirstPerson')}
          </button>
        </div>
      </div>
    );
  }

  const breadcrumbs = history ? history.stack.slice(0, history.index + 1) : [];

  return (
    <div className="tree-view">
      <div className="tree-canvas" ref={canvasRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          minZoom={0.1}
          maxZoom={2}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
          <MiniMap pannable zoomable ariaLabel={nls.t('tree.canvas.minimap')} />
          <Panel position="bottom-left" className="tree-zoom">
            <button
              type="button"
              title={nls.t('tree.canvas.zoomIn')}
              aria-label={nls.t('tree.canvas.zoomIn')}
              onClick={() => void zoomIn({ duration: 150 })}
            >
              <ZoomIn size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              title={nls.t('tree.canvas.zoomOut')}
              aria-label={nls.t('tree.canvas.zoomOut')}
              onClick={() => void zoomOut({ duration: 150 })}
            >
              <ZoomOut size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              title={nls.t('tree.canvas.fit')}
              aria-label={nls.t('tree.canvas.fit')}
              onClick={fitChart}
            >
              <Maximize2 size={16} aria-hidden="true" />
            </button>
          </Panel>
          {form && (
            <Panel position="top-right" className="person-form-panel">
              <PersonForm
                title={formTitle}
                initial={
                  form.relation === 'rename'
                    ? persons.find((person) => person.id === form.anchorId)
                    : undefined
                }
                onSubmit={handleFormSubmit}
                onCancel={() => setForm(null)}
              />
            </Panel>
          )}
          <Panel position="top-left" className="tree-toolbar-panel">
            <TreeToolbar
              kind={kind}
              onKindChange={setKind}
              canGoBack={history !== null && history.index > 0}
              canGoForward={history !== null && history.index < history.stack.length - 1}
              onBack={goBack}
              onForward={goForward}
              onCollapseAll={collapseAll}
              onExpandAll={expandAll}
              breadcrumbs={breadcrumbs}
              focusPersonId={effectiveFocus}
              persons={persons}
              onJump={jumpTo}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onSearchSelect={(personId) => {
                refocus(personId);
                setSearchQuery('');
              }}
            />
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

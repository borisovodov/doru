import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  Position,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { layoutPedigree, suggestFocusPerson, isDescendantOf } from '@doru/core/layout';
import type { ChartKind, PedigreeLayout, PersonRecord } from '@doru/core';
import { Minus, Plus, Scan } from 'lucide-react';
import { nls } from '../nls';
import { GenerationBand } from './GenerationBand';
import { MarriageEdge, PedigreeEdge, SeeAlsoEdge } from './PedigreeEdges';
import { PersonCard, type CardAction, type PersonCardData } from './PersonCard';
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

/** The never-saved placeholder card shown on an empty (new) tree. */
const DRAFT_CARD_ID = 'draft:new';

/**
 * A never-persisted card in which a new person is typed right on the canvas
 * (first person of an empty tree, or a child/spouse/parent quick-add). The
 * card renders name inputs with save/cancel controls; saving creates the
 * real person and the draft disappears with the next projection.
 */
interface DraftCard {
  id: string;
  relation: RelativeRelation | 'new';
  anchorId: string;
  editing: boolean;
}

/** One-card layout so the fit math centers the draft like a real chart. */
const DRAFT_LAYOUT: PedigreeLayout = {
  cards: [
    {
      key: DRAFT_CARD_ID,
      personId: DRAFT_CARD_ID,
      role: 'focus',
      familyId: null,
      generation: 0,
      line: null,
      hasSubtree: false,
      x: 0,
      y: 0,
    },
  ],
  edges: [],
  focusKey: DRAFT_CARD_ID,
  width: CARD_WIDTH,
  height: CARD_HEIGHT,
  minX: -CARD_WIDTH / 2,
  minY: -CARD_HEIGHT / 2,
};

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
  const [drafts, setDrafts] = useState<DraftCard[]>([]);
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
        // child | spouse | parent: a draft card to type the name into.
        setDrafts((current) => [
          ...current,
          {
            id: `draft:${action}:${personId}:${crypto.randomUUID()}`,
            relation: action,
            anchorId: personId,
            editing: true,
          },
        ]);
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

  /** Saving a draft card creates the real person it stands for. */
  const handleDraftSave = useCallback(
    (draft: DraftCard, person: PersonRecord) => {
      if (draft.relation === 'new') {
        void api.addPerson(person);
      } else {
        void api.addRelative(draft.relation, draft.anchorId, person);
      }
      setDrafts((current) => current.filter((entry) => entry.id !== draft.id));
    },
    [api],
  );

  /** Cancelling a relative draft removes the card; the first-person draft
   *  just stops editing and stays as the placeholder card. */
  const handleDraftCancel = useCallback((draft: DraftCard) => {
    setDrafts((current) =>
      draft.relation === 'new'
        ? current.map((entry) => (entry.id === draft.id ? { ...entry, editing: false } : entry))
        : current.filter((entry) => entry.id !== draft.id),
    );
  }, []);

  const isEmpty = persons.length === 0;

  // Keep the first-person draft in sync with the tree: an empty tree always
  // has one (idle) placeholder card, and as soon as a person exists the
  // draft goes away. It reappears if the tree becomes empty again.
  useEffect(() => {
    setDrafts((current) => {
      if (isEmpty) {
        return current.some((draft) => draft.relation === 'new')
          ? current
          : [...current, { id: DRAFT_CARD_ID, relation: 'new', anchorId: '', editing: false }];
      }
      return current.filter((draft) => draft.relation !== 'new');
    });
  }, [isEmpty]);

  const projected = useMemo(() => {
    const base = !layout
      ? { nodes: [] as CanvasNode[], edges: [] as Edge[] }
      : projectLayout(layout, persons, collapsed, counts, null, {
          onToggleCollapse: toggleCollapse,
          onAction: handleAction,
        });
    // Draft cards sit next to their anchor (or centered for the first
    // person). Their ids are stable while typing, so React Flow keeps the
    // node mounted and the input state intact across re-projections.
    const draftNodes: CanvasNode[] = drafts.map((draft, index) => {
      const anchor = draft.relation === 'new'
        ? undefined
        : base.nodes.find(
            (node) =>
              node.type === 'personCard' &&
              (node.data as PersonCardData).person.id === draft.anchorId,
          );
      const cascade = index * 16;
      let position: { x: number; y: number };
      if (!anchor) {
        position = { x: -CARD_WIDTH / 2, y: -CARD_HEIGHT / 2 };
      } else if (draft.relation === 'child') {
        position = { x: anchor.position.x, y: anchor.position.y + CARD_HEIGHT + 24 + cascade };
      } else if (draft.relation === 'spouse') {
        position = { x: anchor.position.x - CARD_WIDTH - 24, y: anchor.position.y + cascade };
      } else {
        // parent
        position = { x: anchor.position.x, y: anchor.position.y - CARD_HEIGHT - 24 + cascade };
      }
      return {
        id: draft.id,
        type: 'personCard',
        position,
        measured: { width: CARD_WIDTH, height: CARD_HEIGHT },
        handles: [
          { type: 'source', position: Position.Bottom, id: 'bottom', x: CARD_WIDTH / 2, y: CARD_HEIGHT },
          { type: 'target', position: Position.Top, id: 'top', x: CARD_WIDTH / 2, y: 0 },
        ],
        draggable: false,
        data: {
          person: { id: draft.id, names: [], sex: 'U' },
          line: null,
          isFocus: false,
          hasSubtree: false,
          collapsed: false,
          counts: { notes: 0, sources: 0, media: 0 },
          isDropTarget: false,
          isDraft: true,
          isEditing: draft.editing,
          onDraftSave: (person) => handleDraftSave(draft, person),
          onDraftCancel: () => handleDraftCancel(draft),
        } satisfies PersonCardData,
      };
    });
    // Drafts come last so they paint above the real cards (React Flow stacks
    // nodes in DOM order); a draft must never end up hidden under a card.
    return { nodes: [...base.nodes, ...draftNodes], edges: base.edges };
  }, [
    isEmpty,
    layout,
    persons,
    collapsed,
    counts,
    toggleCollapse,
    handleAction,
    drafts,
    handleDraftSave,
    handleDraftCancel,
  ]);

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
  // The draft card of an empty tree gets the same fit treatment via its
  // one-card layout.
  const fitTarget = layout ?? (isEmpty ? DRAFT_LAYOUT : null);
  const fitChart = useCallback(() => {
    const el = canvasRef.current;
    if (!el || !fitTarget || el.clientWidth === 0 || el.clientHeight === 0) {
      return;
    }
    void setViewport(computeFit(fitTarget, el.clientWidth, el.clientHeight));
  }, [fitTarget, setViewport]);

  useEffect(() => {
    if (!fitTarget) {
      return;
    }
    const timer = setTimeout(fitChart, 0);
    return () => clearTimeout(timer);
  }, [fitTarget, fitChart]);

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

  // A single click on the idle first-person draft card switches it into
  // editing mode; the detail check keeps a double-click from firing twice.
  const handleNodeClick = useCallback((event: React.MouseEvent, node: CanvasNode) => {
    const data = node.data as PersonCardData;
    if (data.isDraft && !data.isEditing && event.detail === 1) {
      setDrafts((current) =>
        current.map((draft) => (draft.id === node.id ? { ...draft, editing: true } : draft)),
      );
    }
  }, []);

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
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          zoomOnDoubleClick={false}
          // Trackpad gesture model, same on every platform: two-finger scroll
          // pans the canvas, pinch zooms (browsers surface pinch as
          // ctrl+wheel, which @xyflow/react handles natively). Mouse users
          // zoom with Ctrl/Cmd+scroll or the zoom buttons.
          zoomOnScroll={false}
          panOnScroll={true}
          zoomOnPinch={true}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
          <Panel position="bottom-left" className="tree-zoom">
            <button
              type="button"
              title={nls.t('tree.canvas.zoomOut')}
              aria-label={nls.t('tree.canvas.zoomOut')}
              onClick={() => void zoomOut({ duration: 150 })}
            >
              <Minus size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              title={nls.t('tree.canvas.zoomIn')}
              aria-label={nls.t('tree.canvas.zoomIn')}
              onClick={() => void zoomIn({ duration: 150 })}
            >
              <Plus size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              title={nls.t('tree.canvas.fit')}
              aria-label={nls.t('tree.canvas.fit')}
              onClick={fitChart}
            >
              <Scan size={16} aria-hidden="true" />
            </button>
          </Panel>
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

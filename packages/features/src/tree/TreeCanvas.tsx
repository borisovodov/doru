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
import { layoutPedigree, suggestFocusPerson, isDescendantOf } from '@doru/core/layout';
import type { ChartKind, FamilyRecord, PersonRecord } from '@doru/core';
import { ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, Search, X } from 'lucide-react';
import { nls } from '../nls';
import { displayName } from '../person/format';
import { GenerationBand, type GenerationBandData } from './GenerationBand';
import { MarriageEdge, PedigreeEdge, SeeAlsoEdge, type CanvasEdgeData } from './PedigreeEdges';
import { PersonCard, type CardAction, type PersonCardData } from './PersonCard';
import { PersonForm } from './PersonForm';
import '@xyflow/react/dist/style.css';
import './TreeCanvas.css';

export type RelativeRelation = 'child' | 'spouse' | 'parent';

export interface PersonCounts {
  notes: number;
  sources: number;
  media: number;
}

export interface TreeCanvasApi {
  /** Creates a person and links them to the anchor (child/spouse/parent). */
  addRelative(relation: RelativeRelation, anchorId: string, person: PersonRecord): Promise<void>;
  /** Detaches the person from all families and deletes the record. */
  deletePerson(person: PersonRecord): Promise<void>;
  /** Moves a person (as a child) into the family of `newParentId`. */
  reparent(childId: string, newParentId: string): Promise<void>;
  /** Updates the person record (rename, dates). */
  updatePerson(before: PersonRecord, after: PersonRecord): Promise<void>;
  /** Badge counts (notes, sources, media) for the given persons. */
  getPersonCounts(personIds: string[]): Promise<Record<string, PersonCounts>>;
  /** Opens the full person editor (a PersonTab). */
  openEditor(personId: string): void;
}

export interface TreeCanvasProps {
  persons: PersonRecord[];
  families: FamilyRecord[];
  api: TreeCanvasApi;
  /** External focus request (e.g. a click in the People sidebar). */
  focusRequest?: { personId: string; nonce: number } | null;
}

/** Must match the card size in TreeCanvas.css — the layout depends on it. */
const CARD_WIDTH = 180;
const CARD_HEIGHT = 64;
const ROW_HEIGHT = CARD_HEIGHT + 48;

const nodeTypes = { personCard: PersonCard, generationBand: GenerationBand };
const edgeTypes = { pedigree: PedigreeEdge, marriage: MarriageEdge, seeAlso: SeeAlsoEdge };

const CHART_KINDS = [
  { kind: 'ancestors', key: 'tree.canvas.view.ancestors' },
  { kind: 'descendants', key: 'tree.canvas.view.descendants' },
  { kind: 'hourglass', key: 'tree.canvas.view.hourglass' },
  { kind: 'family', key: 'tree.canvas.view.family' },
] as const satisfies ReadonlyArray<{ kind: ChartKind; key: string }>;

interface FocusHistory {
  stack: string[];
  index: number;
}

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
  const { setViewport, getIntersectingNodes } = useReactFlow();

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

  const handleAction = useCallback(
    (action: CardAction, personId: string) => {
      const person = persons.find((entry) => entry.id === personId);
      if (!person) {
        return;
      }
      if (action === 'edit') {
        api.openEditor(personId);
        return;
      }
      if (action === 'delete') {
        void api.deletePerson(person);
        return;
      }
      if (action === 'rename') {
        setForm({ relation: 'rename', anchorId: personId });
        return;
      }
      setForm({ relation: action, anchorId: personId });
    },
    [persons, api],
  );

  const projected = useMemo(() => {
    if (!layout) {
      return {
        nodes: [] as Node<PersonCardData | GenerationBandData, string>[],
        edges: [] as Edge[],
      };
    }
    const personById = new Map(persons.map((person) => [person.id, person]));
    const toggleCollapse = (personId: string) => {
      setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(personId)) {
          next.delete(personId);
        } else {
          next.add(personId);
        }
        return next;
      });
    };
    // Generation bands sit behind the cards: render them first so they stay
    // below in the DOM order.
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
    const flowNodes: Node<PersonCardData | GenerationBandData, string>[] = [
      ...bandNodes,
      ...layout.cards.map((card) => ({
        id: card.key,
        type: 'personCard',
        position: { x: card.x - CARD_WIDTH / 2, y: card.y - CARD_HEIGHT / 2 },
        data: {
          person: personById.get(card.personId) ?? { id: card.personId, names: [], sex: 'U' },
          line: card.line,
          isFocus: card.key === layout.focusKey,
          hasSubtree: card.hasSubtree,
          collapsed: collapsed.has(card.personId),
          counts: counts[card.personId] ?? { notes: 0, sources: 0, media: 0 },
          onToggleCollapse: toggleCollapse,
          onAction: handleAction,
        } satisfies PersonCardData,
      })),
    ];
    const flowEdges: Edge[] = layout.edges.map((edge) => ({
      id: edge.id,
      type: edge.kind,
      source: edge.source,
      target: edge.target,
      data: edge.geometry as CanvasEdgeData,
    }));
    return { nodes: flowNodes, edges: flowEdges };
  }, [layout, persons, collapsed, counts, handleAction]);

  // React Flow is controlled through these two states: every projection
  // resets them, and UI-only changes (selection) are applied through the
  // standard change handlers.
  const [nodes, setNodes] = useState<Node<PersonCardData | GenerationBandData, string>[]>([]);
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
    setNodes(
      (current) =>
        applyNodeChanges(changes, current) as Node<PersonCardData | GenerationBandData, string>[],
    );
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
    const anchor = persons.find((person) => person.id === form.anchorId);
    const name = displayName(anchor);
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
  const handleNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node<PersonCardData | GenerationBandData>) => {
      const data = node.data as PersonCardData;
      if (!data.person) {
        setNodes(projected.nodes);
        return;
      }
      const target = getIntersectingNodes(node).find(
        (candidate) => candidate.type === 'personCard' && candidate.id !== node.id,
      );
      const targetPerson = (target?.data as PersonCardData | undefined)?.person;
      if (
        !targetPerson ||
        targetPerson.id === data.person.id ||
        isDescendantOf(persons, families, data.person.id, targetPerson.id)
      ) {
        setNodes(projected.nodes);
        return;
      }
      void api.reparent(data.person.id, targetPerson.id);
    },
    [getIntersectingNodes, persons, families, api, projected],
  );

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node<PersonCardData | GenerationBandData>) => {
      const data = node.data as PersonCardData;
      if (data.person) {
        refocus(data.person.id);
      }
    },
    [refocus],
  );

  const searchQueryText = searchQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (searchQueryText === '') {
      return [];
    }
    return persons
      .map((person) => ({ person, name: displayName(person) }))
      .filter((entry) => entry.name.toLowerCase().includes(searchQueryText))
      .slice(0, 8);
  }, [searchQueryText, persons]);

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
          minZoom={0.1}
          maxZoom={2}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeDragStop={handleNodeDragStop}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
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
          <Panel position="top-left" className="tree-toolbar">
            <div className="tree-direction" role="group">
              {CHART_KINDS.map((entry) => (
                <button
                  key={entry.kind}
                  type="button"
                  className={kind === entry.kind ? 'active' : undefined}
                  onClick={() => setKind(entry.kind)}
                >
                  {nls.t(entry.key)}
                </button>
              ))}
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
              <button
                type="button"
                title={nls.t('tree.canvas.collapseAll')}
                aria-label={nls.t('tree.canvas.collapseAll')}
                onClick={collapseAll}
              >
                <ChevronsDownUp size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                title={nls.t('tree.canvas.expandAll')}
                aria-label={nls.t('tree.canvas.expandAll')}
                onClick={expandAll}
              >
                <ChevronsUpDown size={16} aria-hidden="true" />
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
            <div className="tree-search">
              <Search size={14} aria-hidden="true" />
              <input
                value={searchQuery}
                placeholder={nls.t('tree.canvas.search.placeholder')}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setSearchQuery('');
                  }
                }}
              />
              {searchResults.length > 0 && (
                <ul className="tree-search-results">
                  {searchResults.map(({ person, name }) => (
                    <li key={person.id}>
                      <button
                        type="button"
                        onClick={() => {
                          refocus(person.id);
                          setSearchQuery('');
                        }}
                      >
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

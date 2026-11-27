import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { layoutPedigree, suggestFocusPerson, isDescendantOf } from '@doru/core/layout';
import type { ChartKind, PedigreeLayout, PersonRecord } from '@doru/core';
import { Minus, Plus, Scan } from 'lucide-react';
import {
  Canvas,
  CanvasBackground,
  CanvasItem,
  CanvasOverlay,
  CanvasPanel,
  CanvasProvider,
  CanvasWorld,
  rectsIntersect,
  useCanvas,
  type Rect,
} from '@doru/canvas';
import { IconButton } from '@doru/ui';
import { PersonCardEditor, PersonCardView, TreeToolbar, type CardAction } from '@doru/ui/domain';
import { nls } from '../nls';
import { CardToolbar } from './CardToolbar';
import { PersonCard } from './PersonCard';
import { TreeEdges } from './PedigreeEdges';
import { CARD_HEIGHT, CARD_WIDTH, ROW_HEIGHT } from './sizes';
import { buildTreeView } from './view';
import type { FocusHistory, PersonCounts, RelativeRelation, TreeCanvasProps } from './types';
import './TreeCanvas.css';

export type { PersonCounts, RelativeRelation, TreeCanvasApi, TreeCanvasProps } from './types';

/** The never-saved placeholder card shown on an empty (new) tree. */
const DRAFT_CARD_ID = 'draft:new';

const EMPTY_COUNTS: Record<string, PersonCounts> = {};
const EMPTY_PERSON_COUNTS: PersonCounts = { notes: 0, sources: 0, media: 0 };
const FIT_OPTIONS = { padding: 0.12, maxZoom: 1 } as const;

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

const IDLE_NEW_DRAFT: DraftCard = {
  id: DRAFT_CARD_ID,
  relation: 'new',
  anchorId: '',
  editing: false,
};

export function TreeCanvas(props: TreeCanvasProps) {
  return (
    <CanvasProvider>
      <TreeCanvasInner {...props} />
    </CanvasProvider>
  );
}

function TreeCanvasInner({ persons, families, photos = new Map(), api, focusRequest }: TreeCanvasProps) {
  const { addPerson, addRelative, deletePerson, reparent, getPersonCounts, openEditor } = api;
  const [kind, setKind] = useState<ChartKind>('ancestors');
  const [history, setHistory] = useState<FocusHistory | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [drafts, setDrafts] = useState<DraftCard[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [dropError, setDropError] = useState(false);
  const [countResult, setCountResult] = useState<{
    layout: PedigreeLayout;
    counts: Record<string, PersonCounts>;
  } | null>(null);
  const draggingKeyRef = useRef<string | null>(null);

  const suggested = suggestFocusPerson(persons, families);
  const focusId = history ? history.stack[history.index] : suggested;
  // Fall back to the suggested focus when the history points at a person
  // that no longer exists (deleted by an edit or an agent).
  const effectiveFocus = focusId !== undefined && persons.some((person) => person.id === focusId) ? focusId : suggested;

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

  const activeCounts = layout !== null && countResult?.layout === layout ? countResult.counts : EMPTY_COUNTS;

  const view = useMemo(() => {
    if (!layout) {
      return null;
    }
    return buildTreeView(layout, persons, collapsed, activeCounts, photos);
  }, [layout, persons, collapsed, activeCounts, photos]);

  const isEmpty = persons.length === 0;

  // An empty tree always shows one idle placeholder card. It is derived here
  // instead of stored in state, so no effect has to synchronize it with the
  // person list; the editing copy is added to `drafts` on first interaction.
  const visibleDrafts = useMemo(() => {
    const relatives = drafts.filter((draft) => draft.relation !== 'new');
    if (!isEmpty) {
      return relatives;
    }
    const newDraft = drafts.find((draft) => draft.relation === 'new');
    return [newDraft ?? IDLE_NEW_DRAFT, ...relatives];
  }, [drafts, isEmpty]);

  const cardKeySet = useMemo(() => new Set(view?.cards.map((entry) => entry.card.key) ?? []), [view]);
  const effectiveSelectedKey = selectedKey !== null && cardKeySet.has(selectedKey) ? selectedKey : null;

  useEffect(() => {
    if (!layout) {
      return;
    }
    let cancelled = false;
    const ids = [...new Set(layout.cards.map((card) => card.personId))];
    void getPersonCounts(ids).then((result) => {
      if (!cancelled) {
        setCountResult({ layout, counts: result });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [layout, getPersonCounts]);

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
        openEditor(personId);
      } else if (action === 'delete') {
        void deletePerson(person);
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
    [persons, openEditor, deletePerson],
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
        void addPerson(person);
      } else {
        void addRelative(draft.relation, draft.anchorId, person);
      }
      setDrafts((current) => current.filter((entry) => entry.id !== draft.id));
    },
    [addPerson, addRelative],
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

  const startDraftEditing = useCallback((draftId: string) => {
    setDrafts((current) => {
      const existing = current.find((draft) => draft.id === draftId);
      if (existing === undefined) {
        return [...current, { ...IDLE_NEW_DRAFT, editing: true }];
      }
      return current.map((draft) => (draft.id === draftId ? { ...draft, editing: true } : draft));
    });
  }, []);

  // External focus requests (e.g. a click in the People sidebar).
  const lastFocusRequestRef = useRef(0);
  useEffect(() => {
    if (focusRequest && focusRequest.nonce !== lastFocusRequestRef.current) {
      lastFocusRequestRef.current = focusRequest.nonce;
      refocus(focusRequest.personId);
    }
  }, [focusRequest, refocus]);

  const goBack = useCallback(() => {
    setHistory((current) => (current && current.index > 0 ? { ...current, index: current.index - 1 } : current));
  }, []);

  const goForward = useCallback(() => {
    setHistory((current) =>
      current && current.index < current.stack.length - 1 ? { ...current, index: current.index + 1 } : current,
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

  const handleSelect = useCallback((cardKey: string) => {
    setSelectedKey(cardKey);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedKey(null);
  }, []);

  const handleActivate = useCallback(
    (cardKey: string) => {
      const entry = view?.cards.find((card) => card.card.key === cardKey);
      if (entry) {
        refocus(entry.person.id);
      }
    },
    [view, refocus],
  );

  const findDropTarget = useCallback(
    (cardKey: string, dx: number, dy: number): string | null => {
      if (!layout) {
        return null;
      }
      const dragged = layout.cards.find((card) => card.key === cardKey);
      if (!dragged) {
        return null;
      }
      const draggedRect = {
        x: dragged.x - CARD_WIDTH / 2 + dx,
        y: dragged.y - CARD_HEIGHT / 2 + dy,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      };
      const target = layout.cards.find((card) => {
        if (card.key === cardKey || card.personId === dragged.personId) {
          return false;
        }
        if (isDescendantOf(families, dragged.personId, card.personId)) {
          return false;
        }
        const rect = {
          x: card.x - CARD_WIDTH / 2,
          y: card.y - CARD_HEIGHT / 2,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
        };
        return rectsIntersect(draggedRect, rect);
      });
      return target?.key ?? null;
    },
    [layout, families],
  );

  const handleDragStart = useCallback((cardKey: string) => {
    // One pointer gesture owns the shared drop highlight at a time.
    if (draggingKeyRef.current !== null) {
      return;
    }
    draggingKeyRef.current = cardKey;
    setDraggingKey(cardKey);
    setSelectedKey(cardKey);
    setDropTargetKey(null);
  }, []);

  const handleDragMove = useCallback(
    (cardKey: string, dx: number, dy: number) => {
      if (draggingKeyRef.current !== cardKey) {
        return;
      }
      const targetKey = findDropTarget(cardKey, dx, dy);
      setDropTargetKey((current) => (current === targetKey ? current : targetKey));
    },
    [findDropTarget],
  );

  const handleDragEnd = useCallback(
    (cardKey: string, dx: number, dy: number, cancelled: boolean) => {
      if (draggingKeyRef.current !== cardKey) {
        return;
      }
      draggingKeyRef.current = null;
      setDraggingKey(null);
      setDropTargetKey(null);
      if (cancelled || !layout) {
        return;
      }
      // Resolve the target at release for this specific card. A shared
      // last-move target could belong to another pointer on a touch screen.
      const targetKey = findDropTarget(cardKey, dx, dy);
      if (targetKey === null) {
        return;
      }
      const dragged = layout.cards.find((card) => card.key === cardKey);
      const target = layout.cards.find((card) => card.key === targetKey);
      if (!dragged || !target) {
        return;
      }
      void reparent(dragged.personId, target.personId)
        .then(() => setDropError(false))
        .catch(() => setDropError(true));
    },
    [findDropTarget, layout, reparent],
  );

  const fitBounds = useMemo<Rect | undefined>(() => {
    if (layout) {
      return { x: layout.minX, y: layout.minY, width: layout.width, height: layout.height };
    }
    if (isEmpty) {
      return { x: -CARD_WIDTH / 2, y: -CARD_HEIGHT / 2, width: CARD_WIDTH, height: CARD_HEIGHT };
    }
    return undefined;
  }, [layout, isEmpty]);

  // Only the shape of the chart triggers a fit. Renames and date edits
  // recompute the layout but keep the same card set and bounds, so the
  // user's camera survives them.
  const shapeKey = useMemo(() => {
    if (!layout) {
      return isEmpty ? 'empty' : 'none';
    }
    return [
      layout.focusKey,
      kind,
      [...collapsed].sort().join(','),
      layout.cards.map((card) => card.key).join('|'),
      layout.minX,
      layout.minY,
      layout.width,
      layout.height,
    ].join('§');
  }, [layout, kind, collapsed, isEmpty]);

  const selectedCard = view?.cards.find((entry) => entry.card.key === effectiveSelectedKey);
  const selectedRect = selectedCard
    ? {
        x: selectedCard.card.x - CARD_WIDTH / 2,
        y: selectedCard.card.y - CARD_HEIGHT / 2,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      }
    : null;

  const draftItems = useMemo(() => {
    return visibleDrafts.map((draft, index) => {
      const anchor =
        draft.relation === 'new' ? undefined : view?.cards.find((entry) => entry.person.id === draft.anchorId)?.card;
      const cascade = index * 16;
      let x: number;
      let y: number;
      if (!anchor) {
        x = -CARD_WIDTH / 2;
        y = -CARD_HEIGHT / 2;
      } else {
        const left = anchor.x - CARD_WIDTH / 2;
        const top = anchor.y - CARD_HEIGHT / 2;
        if (draft.relation === 'child') {
          x = left;
          y = top + CARD_HEIGHT + 24 + cascade;
        } else if (draft.relation === 'spouse') {
          x = left - CARD_WIDTH - 24;
          y = top + cascade;
        } else {
          x = left;
          y = top - CARD_HEIGHT - 24 + cascade;
        }
      }
      return { draft, x, y };
    });
  }, [visibleDrafts, view]);

  const breadcrumbs = history ? history.stack.slice(0, history.index + 1) : [];

  return (
    <div className="tree-view">
      <Canvas
        className="tree-canvas"
        ariaLabel={nls.t('workbench.activityBar.tree')}
        fitBounds={fitBounds}
        fitKey={shapeKey}
        fitOptions={FIT_OPTIONS}
        onPaneClick={handleClearSelection}
      >
        <CanvasBackground gap={24} size={1} color="var(--doru-border)" />
        <CanvasWorld>
          {layout &&
            view?.bands.map(({ generation, y }) => (
              <div
                key={generation}
                className={generation % 2 === 0 ? 'generation-band even' : 'generation-band odd'}
                style={{
                  left: layout.minX - 240,
                  top: y - ROW_HEIGHT / 2,
                  width: layout.width + 480,
                  height: ROW_HEIGHT,
                }}
              />
            ))}
          {layout && view && (
            <TreeEdges
              edges={view.edges}
              bounds={{
                minX: layout.minX,
                minY: layout.minY,
                width: layout.width,
                height: layout.height,
              }}
              hiddenKey={draggingKey}
            />
          )}
          {view?.cards.map((entry) => (
            <PersonCard
              key={entry.card.key}
              card={entry.card}
              person={entry.person}
              counts={entry.counts}
              photo={entry.photo}
              isFocus={entry.isFocus}
              selected={effectiveSelectedKey === entry.card.key}
              isDropTarget={dropTargetKey === entry.card.key}
              collapsed={entry.collapsed}
              onSelect={handleSelect}
              onClearSelection={handleClearSelection}
              onActivate={handleActivate}
              onToggleCollapse={toggleCollapse}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
            />
          ))}
          {draftItems.map(({ draft, x, y }) => (
            <DraftPersonCard
              key={draft.id}
              draft={draft}
              x={x}
              y={y}
              onStartEditing={() => startDraftEditing(draft.id)}
              onSave={(person) => handleDraftSave(draft, person)}
              onCancel={() => handleDraftCancel(draft)}
            />
          ))}
        </CanvasWorld>
        {dropError && (
          <CanvasPanel position="top-right">
            <div className="tree-drop-error" role="status">
              {nls.t('tree.canvas.cycle')}
            </div>
          </CanvasPanel>
        )}
        <CanvasPanel position="bottom-left">
          <ZoomControls fitBounds={fitBounds} />
        </CanvasPanel>
        <CanvasPanel position="top-left">
          <div className="tree-toolbar-panel">
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
            />
          </div>
        </CanvasPanel>
        {selectedCard && selectedRect && draggingKey === null && (
          <CanvasOverlay anchor={selectedRect} position="top" offset={8}>
            <CardToolbar personId={selectedCard.person.id} onAction={handleAction} />
          </CanvasOverlay>
        )}
      </Canvas>
    </div>
  );
}

function ZoomControls({ fitBounds }: { fitBounds: Rect | undefined }) {
  const canvas = useCanvas();
  return (
    <div className="tree-zoom">
      <IconButton
        size="sm"
        label={nls.t('tree.canvas.zoomOut')}
        icon={<Minus size={16} aria-hidden="true" />}
        onClick={() => void canvas.zoomOut({ duration: 150 })}
      />
      <IconButton
        size="sm"
        label={nls.t('tree.canvas.zoomIn')}
        icon={<Plus size={16} aria-hidden="true" />}
        onClick={() => void canvas.zoomIn({ duration: 150 })}
      />
      <IconButton
        size="sm"
        label={nls.t('tree.canvas.fit')}
        icon={<Scan size={16} aria-hidden="true" />}
        onClick={() => {
          if (fitBounds) {
            void canvas.fit(fitBounds, { duration: 150, padding: 0.12, maxZoom: 1 });
          }
        }}
      />
    </div>
  );
}

function DraftPersonCard({
  draft,
  x,
  y,
  onStartEditing,
  onSave,
  onCancel,
}: {
  draft: DraftCard;
  x: number;
  y: number;
  onStartEditing(): void;
  onSave(person: PersonRecord): void;
  onCancel(): void;
}) {
  return (
    <CanvasItem
      x={x}
      y={y}
      width={CARD_WIDTH}
      height={CARD_HEIGHT}
      onClick={(event) => {
        if (!draft.editing && event.detail === 1) {
          onStartEditing();
        }
      }}
    >
      <PersonCardView
        person={{ id: draft.id, names: [], sex: 'U', facts: [] }}
        line={null}
        isFocus={false}
        hasSubtree={false}
        collapsed={false}
        counts={EMPTY_PERSON_COUNTS}
        isDropTarget={false}
        isDraft
        isEditing={draft.editing}
        editingContent={draft.editing ? <PersonCardEditor autoFocus onSave={onSave} onCancel={onCancel} /> : undefined}
        tabIndex={draft.editing ? undefined : 0}
        onKeyDown={(event) => {
          if (draft.editing) {
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onStartEditing();
          } else if (event.key === 'Escape') {
            onCancel();
          }
        }}
      />
    </CanvasItem>
  );
}

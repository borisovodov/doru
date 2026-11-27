import { useCallback, useEffect, useMemo, useState } from 'react';
import { layoutPedigree, suggestFocusPerson } from '@doru/core/layout';
import type { PedigreeLayout, PersonRecord } from '@doru/core';
import { Minus, Plus, Scan } from 'lucide-react';
import {
  Canvas,
  CanvasBackground,
  CanvasItem,
  CanvasOverlay,
  CanvasPanel,
  CanvasProvider,
  CanvasWorld,
  useCanvas,
  type Rect,
} from '@doru/canvas';
import { IconButton } from '@doru/ui';
import { PersonCardEditor, PersonCardView, type CardAction } from '@doru/ui/domain';
import { nls } from '../nls';
import { CardToolbar } from './CardToolbar';
import { PersonCard } from './PersonCard';
import { TreeEdges } from './PedigreeEdges';
import { CARD_HEIGHT, CARD_WIDTH, ROW_HEIGHT } from './sizes';
import { buildTreeView } from './view';
import type { PersonCounts, RelativeRelation, TreeCanvasProps } from './types';
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

function TreeCanvasInner({
  persons,
  families,
  photos = new Map(),
  api,
  focusPersonId,
  onFocusPerson,
}: TreeCanvasProps) {
  const { addPerson, addRelative, deletePerson, getPersonCounts, openEditor } = api;
  const [drafts, setDrafts] = useState<DraftCard[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [countResult, setCountResult] = useState<{
    layout: PedigreeLayout;
    counts: Record<string, PersonCounts>;
  } | null>(null);

  const suggested = suggestFocusPerson(persons, families);
  // Fall back to the suggested focus when the navigation history points at a
  // person that no longer exists (deleted by an edit or an agent).
  const effectiveFocus =
    focusPersonId !== null && persons.some((person) => person.id === focusPersonId) ? focusPersonId : suggested;

  const layout = useMemo(() => {
    if (!effectiveFocus) {
      return null;
    }
    return layoutPedigree(effectiveFocus, persons, families, {
      maxGenerations: 4,
      nodeWidth: CARD_WIDTH,
      nodeHeight: CARD_HEIGHT,
    });
  }, [effectiveFocus, persons, families]);

  const activeCounts = layout !== null && countResult?.layout === layout ? countResult.counts : EMPTY_COUNTS;

  const view = useMemo(() => {
    if (!layout) {
      return null;
    }
    return buildTreeView(layout, persons, activeCounts, photos);
  }, [layout, persons, activeCounts, photos]);

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
        onFocusPerson(entry.person.id);
      }
    },
    [view, onFocusPerson],
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
      layout.cards.map((card) => card.key).join('|'),
      layout.minX,
      layout.minY,
      layout.width,
      layout.height,
    ].join('§');
  }, [layout, isEmpty]);

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
        <CanvasBackground
          gap={64}
          size={2}
          minGap={8}
          minSize={2}
          fadeGap={32}
          minOpacity={0.2}
          color="var(--doru-canvas-dot)"
        />
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
              onSelect={handleSelect}
              onClearSelection={handleClearSelection}
              onActivate={handleActivate}
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
        <CanvasPanel position="bottom-left">
          <ZoomControls fitBounds={fitBounds} />
        </CanvasPanel>
        {selectedCard && selectedRect && (
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
        counts={EMPTY_PERSON_COUNTS}
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

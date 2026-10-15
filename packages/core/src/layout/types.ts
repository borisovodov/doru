import type { PersonRecord } from '../model/types';

export type ChartKind = 'ancestors' | 'descendants' | 'hourglass' | 'family';

/** Which side of the focus an ancestor card sits on. */
export type PedigreeLine = 'paternal' | 'maternal' | null;

export type PedigreeCardRole = 'focus' | 'spouse' | 'child';

export interface PedigreeCard {
  /** Stable role-based key. */
  key: string;
  personId: string;
  role: PedigreeCardRole;
  /** Family this role belongs to; null for the focus card. */
  familyId: string | null;
  /** 0 = the focus row; each generation adds one row (negative rows sit above). */
  generation: number;
  /** Father's side / mother's side in ancestor charts; null elsewhere. */
  line: PedigreeLine;
  /** Whether the card has a collapsible subtree above/below it. */
  hasSubtree: boolean;
}

export type PedigreeEdgeKind = 'marriage' | 'pedigree' | 'see-also';

export interface PedigreeEdge {
  id: string;
  kind: PedigreeEdgeKind;
  /** Card key of one endpoint. */
  source: string;
  /** Card key of the other endpoint. */
  target: string;
  /** Family the edge belongs to; null for see-also links. */
  familyId: string | null;
  /** Exact canvas geometry of the edge (in the layout's coordinate space). */
  geometry: {
    from: { x: number; y: number };
    to: { x: number; y: number };
  };
}

export interface LaidOutCard extends PedigreeCard {
  /** Card center; x grows to the right. */
  x: number;
  /** Card center; y grows down. Ancestors sit at negative y. */
  y: number;
}

export interface PedigreeLayout {
  cards: LaidOutCard[];
  edges: PedigreeEdge[];
  focusKey: string;
  /** Bounding box around all card rects, focus centered at (0, 0). */
  width: number;
  height: number;
  /** Top-left corner of the bounding box in layout coordinates. */
  minX: number;
  minY: number;
}

export interface PedigreeLayoutOptions {
  /** Which chart to draw around the focus (default 'ancestors'). */
  kind?: ChartKind;
  /** Number of ancestor/descendant rows around the focus (default 4). */
  maxGenerations?: number;
  /** Person ids whose subtrees are collapsed (cards stay, branches hide). */
  collapsed?: ReadonlySet<string>;
  /** Uniform card width, must match the rendered card CSS (default 180). */
  nodeWidth?: number;
  /** Uniform card height, must match the rendered card CSS (default 64). */
  nodeHeight?: number;
  /** Horizontal gap between the two cards of a couple (default 16). */
  coupleGap?: number;
  /** Horizontal gap between neighbouring couple slots (default 24). */
  columnGap?: number;
  /** Vertical gap between card rows (default 48). */
  rowGap?: number;
}

export const DEFAULT_OPTIONS: Required<PedigreeLayoutOptions> = {
  kind: 'ancestors',
  maxGenerations: 4,
  collapsed: new Set<string>(),
  nodeWidth: 180,
  nodeHeight: 64,
  coupleGap: 16,
  columnGap: 24,
  rowGap: 48,
};

/** Fathers first, then mothers, then unknown sex — the pedigree convention. */
export const SEX_ORDER: Record<string, number> = { M: 0, F: 1, U: 2 };

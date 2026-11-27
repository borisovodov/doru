import type { LaidOutCard, PedigreeEdge, PedigreeLayout, PersonRecord } from '@doru/core';
import type { PersonCounts } from './types';

export interface TreeCardView {
  card: LaidOutCard;
  person: PersonRecord;
  photo?: string;
  isFocus: boolean;
  collapsed: boolean;
  counts: PersonCounts;
}

export interface TreeBand {
  generation: number;
  /** Card-center y for this generation; bands sit around it. */
  y: number;
}

export interface TreeView {
  /** Generation rows that need a background band, sorted top to bottom. */
  bands: TreeBand[];
  cards: TreeCardView[];
  edges: PedigreeEdge[];
}

const EMPTY_COUNTS: PersonCounts = { notes: 0, sources: 0, media: 0 };

const fallbackPerson = (id: string): PersonRecord => ({ id, names: [], sex: 'U', facts: [] });

/**
 * Maps a pure pedigree layout to the data the canvas renders. All visual state
 * (selection, drag target) stays in the canvas component; this is only the
 * domain-to-view mapping.
 */
export function buildTreeView(
  layout: PedigreeLayout,
  persons: PersonRecord[],
  collapsed: ReadonlySet<string>,
  counts: Record<string, PersonCounts>,
  photos: ReadonlyMap<string, string>,
): TreeView {
  const personById = new Map(persons.map((person) => [person.id, person]));
  const bandY = new Map<number, number>();
  for (const card of layout.cards) {
    const current = bandY.get(card.generation);
    if (current === undefined || card.y < current) {
      bandY.set(card.generation, card.y);
    }
  }
  const bands = [...bandY].map(([generation, y]) => ({ generation, y })).sort((a, b) => a.y - b.y);
  const cards = layout.cards.map((card): TreeCardView => {
    const photo = photos.get(card.personId);
    return {
      card,
      person: personById.get(card.personId) ?? fallbackPerson(card.personId),
      ...(photo === undefined ? {} : { photo }),
      isFocus: card.key === layout.focusKey,
      collapsed: collapsed.has(card.personId),
      counts: counts[card.personId] ?? EMPTY_COUNTS,
    };
  });
  return { bands, cards, edges: layout.edges };
}

import type { LaidOutCard } from './types';

/** Bounding box around the card rects of a laid-out chart. */
export function boundsOf(
  cards: LaidOutCard[],
  nodeWidth: number,
  nodeHeight: number,
): { width: number; height: number; minX: number; minY: number } {
  const minX = Math.min(...cards.map((card) => card.x)) - nodeWidth / 2;
  const maxX = Math.max(...cards.map((card) => card.x)) + nodeWidth / 2;
  const minY = Math.min(...cards.map((card) => card.y)) - nodeHeight / 2;
  const maxY = Math.max(...cards.map((card) => card.y)) + nodeHeight / 2;
  return { width: maxX - minX, height: maxY - minY, minX, minY };
}

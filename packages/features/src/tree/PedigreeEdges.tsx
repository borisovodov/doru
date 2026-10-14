import { BaseEdge, type Edge, type EdgeProps } from '@xyflow/react';

export type CanvasEdgeData = {
  from: { x: number; y: number };
  to: { x: number; y: number };
};

/**
 * A pedigree "bracket" edge: straight down from the parent card, then
 * horizontally at the midpoint between rows, then down into the child card.
 * Two parents share the horizontal segment, which forms the classic
 * genealogy bracket above each child.
 */
export function PedigreeEdge({ id, data }: EdgeProps<Edge<CanvasEdgeData>>) {
  if (!data) {
    return null;
  }
  const { from, to } = data;
  const yJunction = (from.y + to.y) / 2;
  const path = [
    `M ${from.x} ${from.y}`,
    `L ${from.x} ${yJunction}`,
    `L ${to.x} ${yJunction}`,
    `L ${to.x} ${to.y}`,
  ].join(' ');
  return <BaseEdge id={id} path={path} />;
}

/**
 * A marriage line: a short horizontal stroke between the inner edges of two
 * spouse cards on the same row.
 */
export function MarriageEdge({ id, data }: EdgeProps<Edge<CanvasEdgeData>>) {
  if (!data) {
    return null;
  }
  const { from, to } = data;
  return <BaseEdge id={id} path={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} />;
}

import type { PedigreeEdge } from '@doru/core';

export interface TreeBounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

interface EdgePoint {
  x: number;
  y: number;
}

function pedigreePath(from: EdgePoint, to: EdgePoint): string {
  const yJunction = (from.y + to.y) / 2;
  return `M ${from.x} ${from.y} L ${from.x} ${yJunction} L ${to.x} ${yJunction} L ${to.x} ${to.y}`;
}

function marriagePath(from: EdgePoint, to: EdgePoint): string {
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
}

function seeAlsoPath(from: EdgePoint, to: EdgePoint): string {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const bow = Math.abs(to.x - from.x) * 0.25 + 24;
  return `M ${from.x} ${from.y} Q ${midX} ${midY - bow} ${to.x} ${to.y}`;
}

function edgePath(edge: PedigreeEdge, bounds: TreeBounds): string {
  const from = {
    x: edge.geometry.from.x - bounds.minX,
    y: edge.geometry.from.y - bounds.minY,
  };
  const to = {
    x: edge.geometry.to.x - bounds.minX,
    y: edge.geometry.to.y - bounds.minY,
  };
  if (edge.kind === 'marriage') {
    return marriagePath(from, to);
  }
  if (edge.kind === 'see-also') {
    return seeAlsoPath(from, to);
  }
  return pedigreePath(from, to);
}

/**
 * The SVG edge layer. Paths are precomputed by the layout, so this component
 * only shifts them into the layout bounds and paints them. While a card is
 * dragged its incident edges are hidden: the card is being re-parented, not
 * moved, and a detached bracket would be misleading.
 */
export function TreeEdges({
  edges,
  bounds,
  hiddenKey,
}: {
  edges: PedigreeEdge[];
  bounds: TreeBounds;
  hiddenKey: string | null;
}) {
  const visible = edges.filter(
    (edge) => hiddenKey === null || (edge.source !== hiddenKey && edge.target !== hiddenKey),
  );
  if (visible.length === 0) {
    return null;
  }
  return (
    <svg
      className="tree-edges"
      aria-hidden="true"
      style={{
        left: bounds.minX,
        top: bounds.minY,
        width: Math.max(1, bounds.width),
        height: Math.max(1, bounds.height),
      }}
      viewBox={`0 0 ${Math.max(1, bounds.width)} ${Math.max(1, bounds.height)}`}
      overflow="visible"
    >
      {visible.map((edge) => (
        <path key={edge.id} className={`tree-edge tree-edge-${edge.kind}`} d={edgePath(edge, bounds)} />
      ))}
    </svg>
  );
}

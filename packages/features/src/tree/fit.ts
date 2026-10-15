import type { PedigreeLayout } from '@doru/core';
import type { Viewport } from '@xyflow/react';

/**
 * Computes the viewport that fits the chart into the canvas: the whole
 * layout bounds, centered, with a padding fraction. Never zooms in beyond
 * 1 — a small tree stays at natural card size instead of ballooning.
 */
export function computeFit(
  layout: PedigreeLayout,
  clientWidth: number,
  clientHeight: number,
  padding = 0.12,
): Viewport {
  const fit = Math.min(clientWidth / layout.width, clientHeight / layout.height);
  const zoom = Math.max(0.1, Math.min(fit * (1 - padding), 1));
  const x = (clientWidth - layout.width * zoom) / 2 - layout.minX * zoom;
  const y = (clientHeight - layout.height * zoom) / 2 - layout.minY * zoom;
  return { x, y, zoom };
}
